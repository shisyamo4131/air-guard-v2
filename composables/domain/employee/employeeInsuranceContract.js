import { Insurance } from "@shisyamo4131/air-guard-v2-schemas";
import {
  plain,
  identifier,
  encodeExpected,
  equal,
  parseDate,
  rawForClass,
} from "../shared/valueContract.js";

// Client-only transition preview and request encoding. Functions remain the
// authoritative actor, latest-state, transition, and persistence boundary.

export const INSURANCE_KINDS = Object.freeze([
  "healthInsurance",
  "pensionInsurance",
  "employmentInsurance",
]);
export const INSURANCE_ACTION_FIELDS = Object.freeze({
  enroll: ["enrollmentDateAt", "number", "isProcessing"],
  enrolled: ["number"],
  cancelEnroll: [],
  exempt: ["lossDateAt", "lossReason"],
  loss: ["lossDateAt", "lossReason", "isRetire"],
  rollback: [],
});
const STATUSES = ["NOT_ENROLLED", "ENROLLED", "EXEMPT"];
const RESTORED_FIELDS = ["status", "previousStatus", "enrollmentDateAt", "number"];
const RESET_FIELDS = ["lossDateAt", "lossReason", "isRetire"];
const ASSIGNED_FIELDS = {
  enroll: [
    "previousStatus", "status", "enrollmentDateAt", "number", "isProcessing",
    ...RESET_FIELDS,
  ],
  enrolled: ["number", "isProcessing", ...RESET_FIELDS],
  cancelEnroll: [
    "status", "previousStatus", "enrollmentDateAt", "number", "isProcessing",
    ...RESET_FIELDS,
  ],
  exempt: [
    "previousStatus", "status", "enrollmentDateAt", "isProcessing", "number",
    ...RESET_FIELDS,
  ],
  loss: [
    "previousStatus", "status", "enrollmentDateAt", "number", ...RESET_FIELDS,
  ],
  rollback: [...RESTORED_FIELDS, "isProcessing", ...RESET_FIELDS],
};

const fail = (code = "invalid-argument") => {
  const error = new Error("invalid employee insurance draft");
  error.code = code;
  throw error;
};

export function insuranceVersions(raw) {
  if (!Object.hasOwn(raw, "insuranceOperationVersions")) {
    return Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, 0]));
  }
  const versions = raw.insuranceOperationVersions;
  if (
    !plain(versions) ||
    Object.keys(versions).length !== INSURANCE_KINDS.length ||
    INSURANCE_KINDS.some(
      (kind) =>
        !Object.hasOwn(versions, kind) ||
        !Number.isSafeInteger(versions[kind]) ||
        versions[kind] < 0,
    )
  ) {
    fail("failed-precondition");
  }
  return { ...versions };
}

function dateOrNull(value) {
  if (value === null) return true;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return (
    value &&
    typeof value.toDate === "function" &&
    Number.isInteger(value.seconds) &&
    Number.isInteger(value.nanoseconds) &&
    value.nanoseconds >= 0 &&
    value.nanoseconds < 1000000000 &&
    Number.isFinite(value.toDate().getTime())
  );
}

function validateKnownValues(value, history = false) {
  if (!plain(value) || !STATUSES.includes(value.status)) {
    fail("failed-precondition");
  }
  if (
    Object.hasOwn(value, "previousStatus") &&
    value.previousStatus !== null &&
    value.previousStatus !== "" &&
    !STATUSES.includes(value.previousStatus)
  ) {
    fail("failed-precondition");
  }
  for (const field of ["enrollmentDateAt", "lossDateAt"]) {
    if (Object.hasOwn(value, field) && !dateOrNull(value[field])) {
      fail("failed-precondition");
    }
  }
  for (const field of ["number", "lossReason"]) {
    if (
      Object.hasOwn(value, field) &&
      value[field] !== null &&
      typeof value[field] !== "string"
    ) {
      fail("failed-precondition");
    }
  }
  if (
    !history &&
    (typeof value.isProcessing !== "boolean" ||
      !Array.isArray(value.history) ||
      (Object.hasOwn(value, "isRetire") && typeof value.isRetire !== "boolean"))
  ) {
    fail("failed-precondition");
  }
}

export function insuranceForOperation(raw, kind) {
  if (!INSURANCE_KINDS.includes(kind)) fail();
  if (!Object.hasOwn(raw, kind)) return new Insurance().toObject();
  validateKnownValues(raw[kind]);
  for (const entry of raw[kind].history) validateKnownValues(entry, true);
  return raw[kind];
}

export function parseEmployeeInsuranceInput(input) {
  if (
    !plain(input) ||
    Object.keys(input).some(
      (key) => !["employeeId", "kind", "action", "changes", "expected"].includes(key),
    ) ||
    !identifier(input.employeeId) ||
    !INSURANCE_KINDS.includes(input.kind) ||
    !Object.hasOwn(INSURANCE_ACTION_FIELDS, input.action) ||
    !plain(input.changes) ||
    !plain(input.expected) ||
    Object.keys(input.expected).length !== 2 ||
    !Object.hasOwn(input.expected, "map") ||
    !Number.isSafeInteger(input.expected.version) ||
    input.expected.version < 0
  ) {
    fail();
  }
  const changes = {};
  for (const [field, value] of Object.entries(input.changes)) {
    if (!INSURANCE_ACTION_FIELDS[input.action].includes(field)) fail();
    if (["enrollmentDateAt", "lossDateAt"].includes(field)) {
      changes[field] = parseDate(value);
    } else if (["isProcessing", "isRetire"].includes(field)) {
      if (typeof value !== "boolean") fail();
      changes[field] = value;
    } else {
      if (
        value !== null &&
        (typeof value !== "string" || value.length > Insurance.classProps[field].length)
      ) {
        fail();
      }
      changes[field] = value;
    }
  }
  return { ...input, changes };
}

export function prepareEmployeeInsurance(raw, input) {
  const versions = insuranceVersions(raw);
  const initializeMap = !Object.hasOwn(raw, input.kind);
  const current = insuranceForOperation(raw, input.kind);
  if (
    versions[input.kind] !== input.expected.version ||
    JSON.stringify(encodeExpected(raw[input.kind])) !==
      JSON.stringify(input.expected.map)
  ) {
    fail("aborted");
  }
  if (versions[input.kind] === Number.MAX_SAFE_INTEGER) {
    fail("failed-precondition");
  }
  const model = new Insurance(rawForClass(current));
  try {
    model[input.action](input.changes);
    model.validate();
  } catch {
    fail();
  }
  if (!STATUSES.includes(model.status)) fail("failed-precondition");
  const mapChanges = {};
  for (const field of ASSIGNED_FIELDS[input.action]) {
    mapChanges[field] = model[field];
  }
  const pushesHistory =
    input.action === "loss" ||
    (input.action === "exempt" &&
      current.status === "ENROLLED" &&
      !current.isProcessing);
  if (pushesHistory) {
    const entry = Object.fromEntries(
      RESTORED_FIELDS.filter((field) => Object.hasOwn(current, field)).map(
        (field) => [field, current[field]],
      ),
    );
    entry.lossDateAt = input.changes.lossDateAt;
    entry.lossReason = input.changes.lossReason;
    mapChanges.history = [...current.history, entry];
  }
  if (input.action === "rollback") {
    const latest = current.history.at(-1);
    for (const field of RESTORED_FIELDS) mapChanges[field] = latest[field];
    mapChanges.history = current.history.slice(0, -1);
  }
  if (
    Object.hasOwn(current, "enrollmentDate") &&
    Object.hasOwn(mapChanges, "enrollmentDateAt") &&
    !equal(current.enrollmentDateAt, mapChanges.enrollmentDateAt)
  ) {
    mapChanges.enrollmentDate = model.enrollmentDate;
  }
  const nextMap = { ...current };
  for (const [field, value] of Object.entries(mapChanges)) {
    if (equal(current[field], value)) delete mapChanges[field];
    else if (value === undefined) delete nextMap[field];
    else nextMap[field] = value;
  }
  return {
    mapChanges,
    nextMap,
    initializeMap,
    versions: { ...versions, [input.kind]: versions[input.kind] + 1 },
    legacyVersions: !Object.hasOwn(raw, "insuranceOperationVersions"),
  };
}
