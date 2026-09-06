import assert from "node:assert/strict";
import test from "node:test";
import { Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { operation, runtime } from "./employeeBackgroundTestSupport.mjs";
import { addOperationResultToBilling, removeOperationResultFromBilling, syncOperationResultToBilling } from "../../functions/modules/billings/index.js";
import { getBillingKey } from "../../functions/modules/billings/utils.js";

const root = "Companies/company", sourcePath = `${root}/Billings/customer_site_2026-09-01`, destinationPath = `${root}/Billings/customer_site_2026-09-02`;
const masterReads = (state) => state.events.filter((path) => /\/(Customers|Sites)\//u.test(path));
for (const contractStatus of ["ACTIVE", "TERMINATED"]) test(`new Billing accepts ${contractStatus} Customer with live Site and reads before writes`, async () => {
  const state = runtime(); state.data.set(`${root}/Customers/customer`, new Customer({ docId: "customer", contractStatus }).toObject());
  await addOperationResultToBilling({ companyId: "company", doc: operation(), firestore: state.firestore });
  assert.deepEqual(masterReads(state), [`${root}/Customers/customer`, `${root}/Sites/site`]); assert.equal(state.writes.length, 1); assert.equal(state.data.get(sourcePath).customerId, "customer");
});
for (const master of ["Customers/customer", "Sites/site"]) for (const failure of ["missing", "other-tenant-only", "read-error"]) test(`new Billing ${master} ${failure} schedules no write`, async () => {
  const state = runtime({ failRead: failure === "read-error" ? (ref) => ref.path === `${root}/${master}` : undefined });
  if (failure !== "read-error") { state.data.delete(`${root}/${master}`); if (failure === "other-tenant-only") state.data.set(`Companies/other/${master}`, { docId: master.split("/")[1] }); }
  await assert.rejects(addOperationResultToBilling({ companyId: "company", doc: operation(), firestore: state.firestore })); assert.equal(state.writes.length, 0);
});
test("unsafe Billing path inputs reject before transaction; maximum compound key remains valid", async () => {
  for (const bad of ["", "../x", " x", "x\u0000", "x".repeat(129)]) {
    const state = runtime(); await assert.rejects(addOperationResultToBilling({ companyId: bad, doc: operation(), firestore: state.firestore })); assert.equal(state.events.length, 0);
    for (const field of ["customerId", "siteId", "billingDate"]) {
      const next = runtime(); await assert.rejects(addOperationResultToBilling({ companyId: "company", doc: { ...operation(), [field]: bad }, firestore: next.firestore })); assert.equal(next.events.length, 0);
    }
  }
  assert.equal(getBillingKey({ customerId: "c".repeat(128), siteId: "s".repeat(128), billingDate: "2026-09-30" }).length, 268);
});
test("transaction retries repeat Billing/Customer/Site and Employee reads before create", async () => {
  const state = runtime({ attempts: 2 }); await addOperationResultToBilling({ companyId: "company", doc: operation(), firestore: state.firestore });
  assert.equal(state.events.filter((path) => path === sourcePath).length, 2); assert.equal(masterReads(state).length, 4); assert.equal(state.employeeReads().length, 4); assert.equal(state.writes.length, 1);
});
test("existing Billing add and same-destination update retain unchanged orphan references without new master reads", async () => {
  const raw = operation(), state = runtime(); await addOperationResultToBilling({ companyId: "company", doc: raw, firestore: state.firestore });
  for (const path of [`${root}/Customers/customer`, `${root}/Sites/site`, `${root}/Employees/a`, `${root}/Employees/b`]) state.data.delete(path);
  state.events.length = 0;
  await addOperationResultToBilling({ companyId: "company", doc: { ...raw, remarks: "add" }, firestore: state.firestore });
  await syncOperationResultToBilling({ companyId: "company", before: raw, after: { ...raw, remarks: "update" }, firestore: state.firestore });
  assert.deepEqual(masterReads(state), []); assert.deepEqual(state.employeeReads(), []); assert.equal(state.data.get(sourcePath).operationResults[0].remarks, "update");
});
for (const contractStatus of ["ACTIVE", "TERMINATED"]) test(`move to absent Billing accepts ${contractStatus} Customer, reads both destinations before writes`, async () => {
  const before = operation(), after = operation(["a", "b"], "2026-09-02"), state = runtime(); await addOperationResultToBilling({ companyId: "company", doc: before, firestore: state.firestore });
  state.data.set(`${root}/Customers/customer`, new Customer({ docId: "customer", contractStatus }).toObject()); state.events.length = 0;
  await syncOperationResultToBilling({ companyId: "company", before, after, firestore: state.firestore });
  assert.deepEqual(state.events.slice(0, 2), [sourcePath, destinationPath]); assert.deepEqual(masterReads(state), [`${root}/Customers/customer`, `${root}/Sites/site`]); assert.equal(state.data.has(sourcePath), false); assert.equal(state.data.has(destinationPath), true);
});
test("absent-destination move retry rereads Customer/Site and Employee on every attempt", async () => {
  const initial = runtime(), before = operation(); await addOperationResultToBilling({ companyId: "company", doc: before, firestore: initial.firestore });
  const state = runtime({ records: [...initial.data], attempts: 2 }); await syncOperationResultToBilling({ companyId: "company", before, after: operation(["a", "b"], "2026-09-02"), firestore: state.firestore });
  assert.equal(masterReads(state).length, 4); assert.equal(state.employeeReads().length, 4); assert.equal(state.writes.length, 2);
});
for (const failure of ["missing-customer", "commit-error"]) test(`move ${failure} leaves source and destination unchanged`, async () => {
  const before = operation(), initial = runtime(); await addOperationResultToBilling({ companyId: "company", doc: before, firestore: initial.firestore });
  const state = runtime({ records: [...initial.data], commitError: failure === "commit-error" }); if (failure === "missing-customer") state.data.delete(`${root}/Customers/customer`);
  await assert.rejects(syncOperationResultToBilling({ companyId: "company", before, after: operation(["a", "b"], "2026-09-02"), firestore: state.firestore })); assert.equal(state.writes.length, 0); assert.equal(state.data.has(sourcePath), true); assert.equal(state.data.has(destinationPath), false);
});
test("move to existing orphan Billing preserves master barrier semantics and both writes are atomic", async () => {
  const before = operation(), after = operation(["a", "b"], "2026-09-02"), state = runtime();
  await addOperationResultToBilling({ companyId: "company", doc: before, firestore: state.firestore });
  await addOperationResultToBilling({ companyId: "company", doc: { ...after, docId: "other-result" }, firestore: state.firestore });
  state.data.delete(`${root}/Customers/customer`); state.data.delete(`${root}/Sites/site`); state.events.length = 0; state.writes.length = 0;
  await syncOperationResultToBilling({ companyId: "company", before, after, firestore: state.firestore }); assert.equal(state.writes.length, 2); assert.equal(state.data.has(sourcePath), false); assert.equal(state.data.get(destinationPath).operationResults.length, 2); assert.deepEqual(masterReads(state), []);
});
test("non-billable, no-op, and remove-only paths do not invoke new master-reference barrier", async () => {
  const state = runtime(), raw = operation(); await addOperationResultToBilling({ companyId: "company", doc: { ...raw, isBillable: false }, firestore: state.firestore }); assert.equal(state.events.length, 0);
  await addOperationResultToBilling({ companyId: "company", doc: raw, firestore: state.firestore }); state.events.length = 0; state.writes.length = 0;
  await syncOperationResultToBilling({ companyId: "company", before: raw, after: raw, firestore: state.firestore }); assert.equal(state.writes.length, 0);
  await removeOperationResultFromBilling({ companyId: "company", operationResult: raw, firestore: state.firestore }); assert.deepEqual(masterReads(state), []); assert.equal(state.data.has(sourcePath), false);
});