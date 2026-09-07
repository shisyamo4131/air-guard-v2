import assert from "node:assert/strict";
import { OperationResult, Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp, FieldValue } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import { parseDate } from "../../functions/shared/employeeContract.js";
const root = "Companies/company";
export function operation(ids = ["a", "b"], day = "2026-09-01", extra = {}) {
  const model = operationDateTime(new OperationResult({ docId: "operation", siteId: "site", customerId: "customer", dateAt: parseDate(day), startTime: "08:00", endTime: "17:00", breakMinutes: 60, useAdjusted: true, adjustedQuantityBase: 1, adjustedUnitPriceBase: 10000, ...extra }));
  model.billingDateAt = parseDate(day);
  for (const id of ids) model.addWorker({ id, isEmployee: true }, -1);
  return model.toObject();
}
export function runtime({ employees = ["a", "b", "c"], records = [], failRead, commitError, attempts = 1 } = {}) {
  const data = new Map([[`${root}/Customers/customer`, new Customer({ docId: "customer" }).toObject()], [`${root}/Sites/site`, { docId: "site" }], ...employees.map((id) => [`${root}/Employees/${id}`, { docId: id, employmentStatus: "RESIGNED" }]), ...records]);
  const events = [], writes = [];
  function ref(path, filters = [], order = null, limit = null) { return { path, id: path.split("/").at(-1), filters, order, maximum: limit, where: (field, op, value) => ref(path, [...filters, [field, op, value]], order, limit), orderBy: (field, direction = "asc") => ref(path, filters, [field, direction], limit), limit: (value) => ref(path, filters, order, value), get: async () => read(ref(path, filters, order, limit)) }; }
  function snapshot(path, raw) { return { id: path.split("/").at(-1), ref: ref(path), exists: raw !== undefined, data: () => raw, get: (field) => raw[field] }; }
  function read(target) {
    if (failRead?.(target)) throw new Error("read rejected");
    if (target.path.split("/").length === 4) return snapshot(target.path, data.get(target.path));
    let docs = [...data].filter(([path]) => path.startsWith(`${target.path}/`) && path.split("/").length === 4).map(([path, raw]) => snapshot(path, raw));
    for (const [field, op, value] of target.filters) docs = docs.filter((doc) => op === "array-contains" ? doc.data()[field]?.includes(value) : doc.data()[field] === value);
    if (target.order) { const [field, direction] = target.order; docs.sort((a, b) => String(a.data()[field]).localeCompare(String(b.data()[field])) * (direction === "asc" ? 1 : -1)); }
    if (target.maximum) docs = docs.slice(0, target.maximum);
    return { docs, empty: docs.length === 0 };
  }
  const firestore = { doc: ref, collection: ref, async runTransaction(callback) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const pending = []; let written = false;
      const transaction = { async get(target) { assert.equal(written, false, "all reads precede every write"); events.push(target.path); return read(target); }, set(target, raw) { written = true; pending.push([target.path, raw]); }, delete(target) { written = true; pending.push([target.path, null]); } };
      await callback(transaction);
      if (commitError) throw new Error("commit rejected");
      if (attempt === attempts - 1) for (const [path, raw] of pending) {
        writes.push([path, raw]);
        if (raw === null) data.delete(path);
        else { const committed = { ...raw }; for (const key of ["createdAt", "updatedAt"]) if (committed[key] instanceof FieldValue) committed[key] = new Timestamp(1788200000, 123456789); data.set(path, committed); }
      }
    }
  } };
  return { firestore, data, events, writes, employeeReads: () => events.filter((path) => path.startsWith(`${root}/Employees/`)) };
}
