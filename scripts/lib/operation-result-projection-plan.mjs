import { createHash } from "node:crypto";
import {
  Billing, Customer, DailyAttendance, DailyOperationByEmployee,
} from "@shisyamo4131/air-guard-v2-schemas";
import { formatJstDate } from "@shisyamo4131/air-guard-v2-schemas/utils";
import { getBillingKey } from "../../functions/modules/billings/utils.js";
import {
  aggregateCandidate, calculationOperation, inspectAggregate,
} from "../../functions/modules/employees/backgroundReferencePlan.js";
import { parseDate, rawForClass } from "../../functions/shared/employeeContract.js";

export const PROJECTION_NAMES = Object.freeze([
  "Billings", "DailyAttendances", "DailyOperationsByEmployee", "SiteEmployeeHistories",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const counts = () => ({ missing: 0, update: 0, noop: 0, extra: 0, blocked: 0 });

function isPlain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function safeIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1500 &&
    value === value.trim() && !/[\/\u0000-\u001f\u007f]/u.test(value);
}

function validDate(value) {
  if (!DATE_PATTERN.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day) return false;
  try { return parseDate(value) instanceof Date; } catch { return false; }
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value?.toBase64 === "function") return Buffer.from(value.toBase64(), "base64");
  return null;
}

export function canonicalizeProjectionValue(value, seen = new WeakSet()) {
  if (value === undefined) return ["undefined"];
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return ["number", "NaN"];
    if (value === Infinity) return ["number", "+Infinity"];
    if (value === -Infinity) return ["number", "-Infinity"];
    if (Object.is(value, -0)) return ["number", "-0"];
    return value;
  }
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new TypeError("invalid-value");
    const seconds = Math.floor(value.getTime() / 1000);
    return ["timestamp", seconds, (value.getTime() - seconds * 1000) * 1000000];
  }
  if (Number.isInteger(value?.seconds) && Number.isInteger(value?.nanoseconds) &&
      typeof value?.toDate === "function") return ["timestamp", value.seconds, value.nanoseconds];
  const bytes = bytesOf(value);
  if (bytes) return ["bytes", bytes.toString("base64")];
  if (typeof value?.latitude === "number" && typeof value?.longitude === "number" &&
      (value.constructor?.name === "GeoPoint" || typeof value?.isEqual === "function")) {
    return ["geo-point", value.latitude, value.longitude];
  }
  if (typeof value?.path === "string" &&
      (value.constructor?.name?.includes("DocumentReference") || value.firestore)) {
    return ["reference", value.path];
  }
  if (typeof value !== "object") throw new TypeError("invalid-value");
  if (seen.has(value)) throw new TypeError("cyclic-value");
  seen.add(value);
  try {
    if (Array.isArray(value)) return ["array", value.map((item) => canonicalizeProjectionValue(item, seen))];
    const source = isPlain(value) ? value :
      (typeof value.toJSON === "function" && isPlain(value.toJSON()) ? value.toJSON() : null);
    if (!source) throw new TypeError("invalid-value");
    return ["map", Object.keys(source).sort().map((key) => [key, canonicalizeProjectionValue(source[key], seen)])];
  } finally { seen.delete(value); }
}

function canonicalText(value) { return JSON.stringify(canonicalizeProjectionValue(value)); }
function equivalent(left, right) { return canonicalText(left) === canonicalText(right); }
function digest(value) { return createHash("sha256").update(canonicalText(value)).digest("hex"); }
export const canonicalProjectionDigest = digest;
export const projectionValuesEqual = equivalent;

function normalizeDocuments(documents, projection, findings) {
  const result = [];
  const ids = new Set();
  if (!Array.isArray(documents)) {
    findings.push(`${projection}:inventory-invalid`);
    return result;
  }
  for (const document of documents) {
    if (!isPlain(document) || !safeIdentifier(document.id) || !isPlain(document.data) || ids.has(document.id)) {
      findings.push(`${projection}:inventory-invalid`);
      continue;
    }
    ids.add(document.id);
    result.push({ id: document.id, data: document.data, updateTime: document.updateTime ?? null });
  }
  return result;
}

function targetOperation(raw, startDate, endDate) {
  return typeof raw?.date === "string" && raw.date >= startDate && raw.date <= endDate;
}

function embeddedTarget(aggregate, targetIds, startDate, endDate) {
  if (!Array.isArray(aggregate?.operationResults)) return false;
  return aggregate.operationResults.some((raw) =>
    (safeIdentifier(raw?.docId) && targetIds.has(raw.docId)) || targetOperation(raw, startDate, endDate));
}

function addFinding(state, code) { state.findings.push(`${state.name}:${code}`); }
function block(state, code, key = null, current = null) {
  state.counts.blocked += 1;
  addFinding(state, code);
  state.details.push({ projection: state.name, action: "blocked", code, key,
    currentRevision: current?.updateTime ?? null });
}
function record(state, action, key, current = null, expected = null, sourceIds = []) {
  state.counts[action] += 1;
  state.details.push({
    projection: state.name, action, key,
    currentRevision: current?.updateTime ?? null,
    expected, sourceIds: [...new Set(sourceIds)].sort(),
  });
}

function projectionState(name) {
  return { name, counts: counts(), findings: [], details: [], candidateKeys: new Set() };
}

function calculatedWorkers(raw, attendance) {
  const model = calculationOperation(raw);
  return model.employees.map((worker) => ({
    employeeId: worker.id,
    date: attendance ? worker.attendanceDate : worker.date,
    dateAt: attendance ? worker.attendanceDateAt : worker.dateAt,
  }));
}

function operationIdentity(raw, id) {
  if (!isPlain(raw) || raw.docId !== id || !safeIdentifier(id)) throw new Error("operation-result-invalid");
  return raw;
}

function groupOperation(map, key, raw, initial) {
  if (!map.has(key)) map.set(key, { operations: new Map(), initial });
  map.get(key).operations.set(raw.docId, raw);
}

function planDaily({ name, Schema, attendance, operations, current, targetIds, startDate, endDate }) {
  const state = projectionState(name);
  const groups = new Map();
  for (const document of operations) {
    try {
      const raw = operationIdentity(document.data, document.id);
      for (const worker of calculatedWorkers(raw, attendance)) {
        const key = `${worker.employeeId}_${worker.date}`;
        if (!safeIdentifier(worker.employeeId) || !validDate(worker.date) || !safeIdentifier(key)) throw new Error();
        groupOperation(groups, key, raw, { docId: key, ...worker, operationResults: [], operationResultIds: [] });
        if (targetOperation(raw, startDate, endDate)) state.candidateKeys.add(key);
      }
    } catch { block(state, "operation-result-invalid"); }
  }
  for (const document of current) {
    if (embeddedTarget(document.data, targetIds, startDate, endDate)) state.candidateKeys.add(document.id);
  }
  const currentById = new Map(current.map((document) => [document.id, document]));
  for (const key of [...state.candidateKeys].sort()) {
    const before = currentById.get(key) || null;
    const group = groups.get(key);
    try { if (before) inspectAggregate(before.data, { daily: true, docId: key }); }
    catch { block(state, "aggregate-invalid", key, before); continue; }
    if (!group) { record(state, "extra", key, before); continue; }
    try {
      const { after, model } = aggregateCandidate(Schema, before?.data || null, group.initial,
        [...group.operations.values()], true);
      const keep = attendance ? model.isAttended : group.operations.size > 0;
      if (!keep) { if (before) record(state, "extra", key, before); continue; }
      const sourceIds = [...group.operations.keys()];
      if (!before) record(state, "missing", key, null, after, sourceIds);
      else record(state, equivalent(before.data, after) ? "noop" : "update", key, before, after, sourceIds);
    } catch { block(state, "aggregate-invalid", key, before); }
  }
  return state;
}

function billingInitial(key, raw, customer) {
  if (!isPlain(customer)) throw new Error("customer-invalid");
  const billingDateAt = rawForClass(raw.billingDateAt);
  if (!(billingDateAt instanceof Date) || !Number.isFinite(billingDateAt.getTime())) throw new Error("operation-result-invalid");
  const paymentDueDateAt = new Customer(rawForClass(customer)).getPaymentDueDateAt(billingDateAt);
  return new Billing({
    docId: key, customerId: raw.customerId, siteId: raw.siteId, billingDateAt,
    paymentDueDateAt, status: Billing.STATUS.DRAFT,
  }).toObject();
}

function planBillings({ operations, current, customers, targetIds, startDate, endDate }) {
  const state = projectionState("Billings");
  const groups = new Map();
  for (const document of operations) {
    try {
      const raw = operationIdentity(document.data, document.id);
      if (typeof raw.isBillable !== "boolean") throw new Error();
      if (!raw.isBillable) continue;
      const key = getBillingKey(raw);
      groupOperation(groups, key, raw, null);
      if (targetOperation(raw, startDate, endDate)) state.candidateKeys.add(key);
    } catch { block(state, "operation-result-invalid"); }
  }
  for (const document of current) {
    if (embeddedTarget(document.data, targetIds, startDate, endDate)) state.candidateKeys.add(document.id);
  }
  const currentById = new Map(current.map((document) => [document.id, document]));
  const requiredCustomerIds = new Set();
  for (const key of [...state.candidateKeys].sort()) {
    const before = currentById.get(key) || null;
    const group = groups.get(key);
    try {
      if (before) {
        inspectAggregate(before.data, { daily: false, docId: key });
        if (getBillingKey(before.data) !== key) throw new Error();
      }
    } catch { block(state, "aggregate-invalid", key, before); continue; }
    if (!group) { record(state, "extra", key, before); continue; }
    try {
      const rawOperations = [...group.operations.values()];
      let initial = null;
      if (!before) {
        const first = rawOperations[0];
        if (!safeIdentifier(first.customerId) || !customers.has(first.customerId)) {
          if (safeIdentifier(first.customerId)) requiredCustomerIds.add(first.customerId);
          block(state, "customer-missing", key);
          continue;
        }
        initial = billingInitial(key, first, customers.get(first.customerId));
      }
      const after = aggregateCandidate(Billing, before?.data || null, initial, rawOperations, false).after;
      const sourceIds = [...group.operations.keys()];
      if (!before) record(state, "missing", key, null, after, sourceIds);
      else record(state, equivalent(before.data, after) ? "noop" : "update", key, before, after, sourceIds);
    } catch (error) {
      block(state, error?.message === "customer-invalid" ? "customer-invalid" : "aggregate-invalid", key, before);
    }
  }
  state.requiredCustomerIds = requiredCustomerIds;
  return state;
}

function historyExpected(before, key, siteId, employeeId, entries) {
  const dates = entries.map((entry) => entry.data.date).sort();
  const firstDate = dates[0], lastDate = dates.at(-1);
  const firstIds = entries.filter((entry) => entry.data.date === firstDate).map((entry) => entry.id).sort();
  const lastIds = entries.filter((entry) => entry.data.date === lastDate).map((entry) => entry.id).sort();
  const tied = firstIds.length > 1 || lastIds.length > 1;
  const firstId = firstIds.length === 1 ? firstIds[0] : before?.firstOperationResultId;
  const lastId = lastIds.length === 1 ? lastIds[0] : before?.lastOperationResultId;
  if (!firstIds.includes(firstId) || !lastIds.includes(lastId)) return { tied, blocked: true };
  const after = { ...(before || {}), docId: key, siteId, employeeId };
  for (const [part, date, id] of [["first", firstDate, firstId], ["last", lastDate, lastId]]) {
    if (!before || before[`${part}Date`] !== date) after[`${part}DateAt`] = parseDate(date);
    after[`${part}Date`] = date;
    after[`${part}OperationResultId`] = id;
  }
  return { tied, blocked: false, after };
}

function validateCurrentHistory(document) {
  const raw = document.data;
  if (!isPlain(raw) || raw.docId !== document.id || raw.docId !== `${raw.siteId}_${raw.employeeId}` ||
      !safeIdentifier(raw.siteId) || !safeIdentifier(raw.employeeId) || raw.firstDate > raw.lastDate) throw new Error();
  for (const part of ["first", "last"]) {
    const dateAt = rawForClass(raw[`${part}DateAt`]);
    if (!validDate(raw[`${part}Date`]) || !(dateAt instanceof Date) || !Number.isFinite(dateAt.getTime()) ||
        formatJstDate(dateAt) !== raw[`${part}Date`] ||
        !safeIdentifier(raw[`${part}OperationResultId`])) throw new Error();
  }
}

function planHistories({ operations, current, targetIds, startDate, endDate }) {
  const state = projectionState("SiteEmployeeHistories");
  const groups = new Map();
  for (const document of operations) {
    try {
      const raw = operationIdentity(document.data, document.id);
      if (!safeIdentifier(raw.siteId) || !validDate(raw.date)) throw new Error();
      const employeeIds = new Set(calculatedWorkers(raw, false).map((worker) => worker.employeeId));
      for (const employeeId of employeeIds) {
        const key = `${raw.siteId}_${employeeId}`;
        if (!safeIdentifier(employeeId) || !safeIdentifier(key)) throw new Error();
        if (!groups.has(key)) groups.set(key, { siteId: raw.siteId, employeeId, entries: [] });
        groups.get(key).entries.push(document);
        if (targetOperation(raw, startDate, endDate)) state.candidateKeys.add(key);
      }
    } catch { block(state, "operation-result-invalid"); }
  }
  for (const document of current) {
    const firstDate = document.data?.firstDate;
    const lastDate = document.data?.lastDate;
    const validInterval = validDate(firstDate) && validDate(lastDate) && firstDate <= lastDate;
    const overlapsTarget = validInterval && firstDate <= endDate && lastDate >= startDate;
    if (!validInterval || overlapsTarget || targetIds.has(document.data?.firstOperationResultId) ||
        targetIds.has(document.data?.lastOperationResultId)) {
      state.candidateKeys.add(document.id);
    }
  }
  const currentById = new Map(current.map((document) => [document.id, document]));
  for (const key of [...state.candidateKeys].sort()) {
    const before = currentById.get(key) || null;
    const group = groups.get(key);
    try { if (before) validateCurrentHistory(before); }
    catch { block(state, "aggregate-invalid", key, before); continue; }
    if (!group) { record(state, "extra", key, before); continue; }
    try {
      const result = historyExpected(before?.data || null, key, group.siteId, group.employeeId, group.entries);
      if (result.blocked) { block(state, "history-boundary-tie", key, before); continue; }
      const same = before && equivalent(before.data, result.after);
      if (result.tied && !same) { block(state, "history-boundary-tie", key, before); continue; }
      const sourceIds = group.entries.map((entry) => entry.id);
      if (!before) record(state, "missing", key, null, result.after, sourceIds);
      else record(state, same ? "noop" : "update", key, before, result.after, sourceIds);
    } catch { block(state, "aggregate-invalid", key, before); }
  }
  return state;
}

export function planOperationResultProjections({
  operationResults = [], billings = [], dailyAttendances = [], dailyOperationsByEmployee = [],
  siteEmployeeHistories = [], customers = new Map(), startDate, endDate,
} = {}) {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new TypeError("invalid-range");
  const inventoryFindings = [];
  const operations = normalizeDocuments(operationResults, "OperationResults", inventoryFindings);
  const collections = {
    Billings: normalizeDocuments(billings, "Billings", inventoryFindings),
    DailyAttendances: normalizeDocuments(dailyAttendances, "DailyAttendances", inventoryFindings),
    DailyOperationsByEmployee: normalizeDocuments(dailyOperationsByEmployee, "DailyOperationsByEmployee", inventoryFindings),
    SiteEmployeeHistories: normalizeDocuments(siteEmployeeHistories, "SiteEmployeeHistories", inventoryFindings),
  };
  const targetIds = new Set(operations.filter(({ data }) => targetOperation(data, startDate, endDate)).map(({ id }) => id));
  const customerMap = customers instanceof Map ? customers : new Map(Object.entries(customers || {}));
  const states = [
    planBillings({ operations, current: collections.Billings, customers: customerMap, targetIds, startDate, endDate }),
    planDaily({ name: "DailyAttendances", Schema: DailyAttendance, attendance: true, operations,
      current: collections.DailyAttendances, targetIds, startDate, endDate }),
    planDaily({ name: "DailyOperationsByEmployee", Schema: DailyOperationByEmployee, attendance: false, operations,
      current: collections.DailyOperationsByEmployee, targetIds, startDate, endDate }),
    planHistories({ operations, current: collections.SiteEmployeeHistories, targetIds, startDate, endDate }),
  ];
  const findingCodes = [...inventoryFindings, ...states.flatMap((state) => state.findings)].sort();
  const findingCodeCounts = {};
  for (const code of findingCodes) findingCodeCounts[code] = (findingCodeCounts[code] || 0) + 1;
  const perProjection = Object.fromEntries(states.map((state) => [state.name, state.counts]));
  const candidateCounts = Object.fromEntries(states.map((state) => [state.name, state.candidateKeys.size]));
  const details = states.flatMap((state) => state.details).sort((a, b) => {
    const left = `${a.projection}\u0000${a.key || ""}\u0000${a.action}`;
    const right = `${b.projection}\u0000${b.key || ""}\u0000${b.action}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const complete = inventoryFindings.length === 0 && states.every((state) => state.counts.blocked === 0);
  const differences = states.some((state) => state.counts.missing + state.counts.update + state.counts.extra > 0);
  return {
    complete, differences, perProjection, candidateCounts, findingCodeCounts,
    planDigest: digest(details.map(({ sourceIds: _sourceIds, ...detail }) => detail)), details,
    requiredCustomerIds: states[0].requiredCustomerIds,
    scanCounts: {
      OperationResults: operations.length,
      Billings: collections.Billings.length,
      DailyAttendances: collections.DailyAttendances.length,
      DailyOperationsByEmployee: collections.DailyOperationsByEmployee.length,
      SiteEmployeeHistories: collections.SiteEmployeeHistories.length,
      Customers: customerMap.size,
    },
  };
}

export function companySubject(companyId) {
  if (!safeIdentifier(companyId)) throw new TypeError("invalid-company");
  return createHash("sha256").update(`airguard-company:${companyId}`).digest("hex");
}
