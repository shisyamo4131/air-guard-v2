import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { OperationResult, DailyAttendance, DailyOperationByEmployee, Billing, Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp, FieldValue } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import { parseDate, encodeExpected } from "../../functions/shared/employeeContract.js";
import { aggregateEmployeeIndex, aggregateEmployeeReferences } from "../../functions/shared/operationReferences.js";
import { syncOperationResultToDailyAttendances } from "../../functions/modules/dailyAttendances/index.js";
import { syncOperationResultToDailyOperationsByEmployee } from "../../functions/modules/dailyOperationsByEmployee/index.js";
import { fetchDailyTargets, changeDailyResults, saveDailyTargets } from "../../functions/modules/employees/dailyReferencePlan.js";
import { addOperationResultToBilling, removeOperationResultFromBilling, syncOperationResultToBilling } from "../../functions/modules/billings/index.js";
import { rebuildHistory } from "../../functions/modules/siteEmployeeHistories/rebuildHistory.js";
import { rebuildAllHistories } from "../../functions/modules/siteEmployeeHistories/rebuildAllHistories.js";
import { inspectEmployeeReferences, runEmployeeReferenceDryRun, EMPLOYEE_REFERENCE_COLLECTIONS } from "../../functions/modules/employees/inspectEmployeeReferences.js";

import { operation, runtime } from "./employeeBackgroundTestSupport.mjs";
const root = "Companies/company";

for (const attendance of [true, false]) test(`daily ${attendance}: successful move retains other raw results; commit refusal and retries are atomic`, async () => {
  const sync = attendance ? syncOperationResultToDailyAttendances : syncOperationResultToDailyOperationsByEmployee;
  const collection = attendance ? "DailyAttendances" : "DailyOperationsByEmployee";
  const original = operation(["a"]), other = operation(["a"], "2026-09-01", { docId: "other" });
  const moved = operation(["a"], "2026-09-02"), state = runtime();
  for (const raw of [original, other]) await sync({ companyId: "company", afterData: raw, firestore: state.firestore });
  const records = [...state.data], refusal = runtime({ records, commitError: true });
  await assert.rejects(sync({ companyId: "company", beforeData: original, afterData: moved, firestore: refusal.firestore }));
  assert.deepEqual([...refusal.data], records); assert.equal(refusal.writes.length, 0);
  const retry = runtime({ records, attempts: 2 });
  await sync({ companyId: "company", beforeData: original, afterData: moved, firestore: retry.firestore });
  assert.deepEqual(retry.data.get(`${root}/${collection}/a_2026-09-01`).operationResultIds, ["other"]);
  assert.deepEqual(retry.data.get(`${root}/${collection}/a_2026-09-02`).operationResultIds, ["operation"]);
  assert.strictEqual(retry.data.get(`${root}/${collection}/a_2026-09-01`).operationResults[0], other);
  assert.equal(retry.employeeReads().length, 2, "one added destination reference on each attempt");
});

test("Billing successful move retains other results and fixed nonzero subtotal", async () => {
  const original = operation(["a"]), other = operation(["a"], "2026-09-01", { docId: "other" }), state = runtime();
  for (const raw of [original, other]) await addOperationResultToBilling({ companyId: "company", doc: raw, firestore: state.firestore });
  assert.equal(state.data.get(`${root}/Billings/customer_site_2026-09-01`).subtotal, 20000);
  await syncOperationResultToBilling({ companyId: "company", before: original, after: operation(["a"], "2026-09-02"), firestore: state.firestore });
  for (const day of ["01", "02"]) assert.equal(state.data.get(`${root}/Billings/customer_site_2026-09-${day}`).subtotal, 10000);
  assert.strictEqual(state.data.get(`${root}/Billings/customer_site_2026-09-01`).operationResults[0], other);
});

test("history last-reference deletion removes the history without a new Employee read", async () => {
  const raw = operation(), state = runtime({ records: [[`${root}/OperationResults/operation`, raw]] });
  await rebuildHistory("company", "site", "a", { firestore: state.firestore });
  state.data.delete(`${root}/OperationResults/operation`); state.data.delete(`${root}/Sites/site`); state.events.length = 0;
  await rebuildHistory("company", "site", "a", { firestore: state.firestore });
  assert.equal(state.data.has(`${root}/SiteEmployeeHistories/site_a`), false); assert.equal(state.employeeReads().length, 0);
});

test("C aggregate calculations and nonempty history use fixed JST dates in UTC and JST processes", () => {
  const script = `
    import assert from 'node:assert/strict';
    import { operation, runtime } from './test/domain/employeeBackgroundTestSupport.mjs';
    import { syncOperationResultToDailyAttendances as attendance } from './functions/modules/dailyAttendances/index.js';
    import { syncOperationResultToDailyOperationsByEmployee as daily } from './functions/modules/dailyOperationsByEmployee/index.js';
    import { addOperationResultToBilling as billing } from './functions/modules/billings/index.js';
    import { rebuildHistory } from './functions/modules/siteEmployeeHistories/rebuildHistory.js';
    const raw = operation(['a'], '2028-02-29', { isStartNextDay: true }), root = 'Companies/company';
    const state = runtime({ records: [[root + '/OperationResults/operation', raw]] });
    await attendance({ companyId: 'company', afterData: raw, firestore: state.firestore });
    await daily({ companyId: 'company', afterData: raw, firestore: state.firestore });
    await billing({ companyId: 'company', doc: raw, firestore: state.firestore });
    await rebuildHistory('company', 'site', 'a', { firestore: state.firestore });
    const attended = state.data.get(root + '/DailyAttendances/a_2028-03-01');
    assert.equal(attended.startTime, '08:00'); assert.equal(attended.endTime, '17:00'); assert.equal(attended.breakMinutes, 60);
    assert.equal(state.data.get(root + '/DailyOperationsByEmployee/a_2028-02-29').totalWorkMinutes, 480);
    assert.equal(state.data.get(root + '/Billings/customer_site_2028-02-29').subtotal, 10000);
    const history = state.data.get(root + '/SiteEmployeeHistories/site_a');
    assert.equal(history.firstDateAt.toDate().toISOString(), '2028-02-28T15:00:00.000Z');
    assert.equal(history.lastDateAt.toDate().toISOString(), '2028-02-28T15:00:00.000Z');
  `;
  for (const TZ of ["UTC", "Asia/Tokyo"]) {
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: new URL("../../", import.meta.url), env: { ...process.env, TZ }, encoding: "utf8" });
    assert.equal(run.status, 0, `${TZ}: ${run.stderr}`);
  }
});

for (const attendance of [true, false]) {
  const collection = attendance ? "DailyAttendances" : "DailyOperationsByEmployee";
  const sync = attendance ? syncOperationResultToDailyAttendances : syncOperationResultToDailyOperationsByEmployee;
  test(`${collection}: new ten-person raw aggregate reads ten Employees; unchanged and deletion read zero`, async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `employee-${i}`), raw = operation(ids), state = runtime({ employees: ids });
    raw.unknown = { stamp: new Timestamp(1788200000, 123456789), optional: null }; raw.employees[0].unknown = { retained: true };
    await sync({ companyId: "company", afterData: raw, firestore: state.firestore });
    assert.equal(state.employeeReads().length, 10); assert.equal(state.writes.length, 10);
    for (const id of ids) { const saved = state.data.get(`${root}/${collection}/${id}_2026-09-01`); assert.equal(saved.employeeIds.length, 10); aggregateEmployeeReferences(saved, { daily: true }); assert.strictEqual(saved.operationResults[0], raw); }
    state.events.length = 0; const path = `${root}/${collection}/${ids[0]}_2026-09-01`, current = state.data.get(path); current.unknown = { stamp: raw.unknown.stamp, nullable: null }; delete current.remarks;
    const after = { ...raw, remarks: "corrected" }; await sync({ companyId: "company", beforeData: raw, afterData: after, firestore: state.firestore });
    assert.equal(state.employeeReads().length, 0); assert.strictEqual(state.data.get(path).unknown.stamp, raw.unknown.stamp); assert.equal(Object.hasOwn(state.data.get(path), "remarks"), false);
    state.events.length = 0; await sync({ companyId: "company", beforeData: after, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.equal(state.data.has(path), false);
  });
  test(`${collection}: a same-destination replacement reads exactly one added embedded Employee`, async () => {
    const before = operation(), state = runtime(); await sync({ companyId: "company", afterData: before, firestore: state.firestore }); state.events.length = 0;
    const after = operation(["a", "c"]);
    await state.firestore.runTransaction(async (transaction) => {
      const entries = await fetchDailyTargets({ companyId: "company", operationResult: before, transaction, attendance, firestore: state.firestore });
      const selected = entries.filter(({ instance }) => instance.employeeId === "a");
      changeDailyResults(selected, after, attendance); await saveDailyTargets({ companyId: "company", entries: selected, transaction, attendance, firestore: state.firestore });
    });
    assert.deepEqual(state.employeeReads(), [`${root}/Employees/c`]); assert.deepEqual(state.data.get(`${root}/${collection}/a_2026-09-01`).employeeIds, ["a", "c"]);
  });
  test(`${collection}: move and deleted-destination late event cannot recreate an absent embedded Employee`, async () => {
    const before = operation(), state = runtime(); await sync({ companyId: "company", afterData: before, firestore: state.firestore });
    state.data.delete(`${root}/Employees/b`); state.writes.length = 0;
    const after = operation(["a", "b"], "2026-09-02");
    await assert.rejects(sync({ companyId: "company", beforeData: before, afterData: after, firestore: state.firestore })); assert.equal(state.writes.length, 0);
    state.data.delete(`${root}/${collection}/a_2026-09-01`);
    await assert.rejects(sync({ companyId: "company", beforeData: before, afterData: before, firestore: state.firestore })); assert.equal(state.writes.length, 0);
  });
  for (const corruption of ["missing-index", "false-index", "worker-type", "read-error"]) test(`${collection}: ${corruption} rejects before write`, async () => {
    const raw = operation(), state = runtime(); await sync({ companyId: "company", afterData: raw, firestore: state.firestore }); state.writes.length = 0;
    const saved = state.data.get(`${root}/${collection}/a_2026-09-01`);
    if (corruption === "missing-index") delete saved.employeeIds;
    if (corruption === "false-index") saved.employeeIds = ["a"];
    if (corruption === "worker-type") saved.operationResults = [{ ...raw, employees: [{ ...raw.employees[0], isEmployee: false }] }];
    if (corruption === "read-error") state.firestore.doc = state.firestore.collection = () => { throw new Error("read rejected"); };
    await assert.rejects(sync({ companyId: "company", beforeData: raw, afterData: raw, firestore: state.firestore })); assert.equal(state.writes.length, 0);
  });
}

test("Billing current raw controls new 10 / unchanged 0 / replacement 1 Employee reads and preserves history", async () => {
  const ids = Array.from({ length: 10 }, (_, i) => `employee-${i}`), raw = operation(ids), state = runtime({ employees: [...ids, "new"] });
  await addOperationResultToBilling({ companyId: "company", doc: raw, firestore: state.firestore }); assert.equal(state.employeeReads().length, 10);
  const path = `${root}/Billings/customer_site_2026-09-01`, initial = state.data.get(path), nano = new Timestamp(1788200000, 123456789); initial.unknown = { nano, nil: null }; initial.paymentDueDateAt = nano;
  state.events.length = 0; await syncOperationResultToBilling({ companyId: "company", before: raw, after: { ...raw, remarks: "changed" }, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.strictEqual(state.data.get(path).paymentDueDateAt, nano);
  state.events.length = 0; const replaced = operation([...ids.slice(0, 9), "new"]); await syncOperationResultToBilling({ companyId: "company", before: raw, after: replaced, firestore: state.firestore }); assert.deepEqual(state.employeeReads(), [`${root}/Employees/new`]); assert.strictEqual(state.data.get(path).unknown.nano, nano);
  state.events.length = 0; await removeOperationResultFromBilling({ companyId: "company", operationResult: replaced, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.equal(state.data.has(path), false);
});

test("Billing move reads destination delta and failure commits neither source nor destination; late recreation checks all", async () => {
  const before = operation(), after = operation(["a", "b"], "2026-09-02"), state = runtime(); await addOperationResultToBilling({ companyId: "company", doc: before, firestore: state.firestore });
  state.data.delete(`${root}/Employees/b`); state.writes.length = 0;
  await assert.rejects(syncOperationResultToBilling({ companyId: "company", before, after, firestore: state.firestore })); assert.equal(state.writes.length, 0);
  state.data.delete(`${root}/Billings/customer_site_2026-09-01`);
  await assert.rejects(syncOperationResultToBilling({ companyId: "company", before, after: before, firestore: state.firestore })); assert.equal(state.writes.length, 0);
});

test("history reads destination raw, validates results, keeps nanos and rejects late regeneration after Employee removal", async () => {
  const first = operation(), last = operation(["a", "b"], "2026-09-12", { docId: "last" }), state = runtime({ records: [[`${root}/OperationResults/operation`, first], [`${root}/OperationResults/last`, last]] });
  await rebuildHistory("company", "site", "a", { firestore: state.firestore });
  const path = `${root}/SiteEmployeeHistories/site_a`, raw = state.data.get(path); assert.equal(raw.firstDateAt.toDate().toISOString(), "2026-08-31T15:00:00.000Z"); assert.equal(raw.lastDateAt.toDate().toISOString(), "2026-09-11T15:00:00.000Z");
  const nano = new Timestamp(raw.firstDateAt.seconds, 123456789); raw.firstDateAt = nano; raw.unknown = { nano }; state.events.length = 0;
  await rebuildHistory("company", "site", "a", { firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.strictEqual(state.data.get(path).firstDateAt, nano);
  state.data.delete(path); state.data.delete(`${root}/Employees/a`); state.writes.length = 0;
  await assert.rejects(rebuildHistory("company", "site", "a", { firestore: state.firestore })); assert.equal(state.writes.length, 0);
  first.employeeIds = []; await assert.rejects(rebuildAllHistories("company", { firestore: state.firestore })); assert.equal(state.writes.length, 0);
});

test("reference dry-run requires all six selected-tenant collections and never grants archive readiness", async () => {
  const collections = Object.fromEntries(EMPLOYEE_REFERENCE_COLLECTIONS.map((name) => [name, []])); collections.OperationResults.push({ id: "operation", raw: operation() });
  const valid = inspectEmployeeReferences({ companyId: "company", collections }); assert.equal(valid.consistent, true); assert.equal(valid.archiveReady, false);
  const absent = { ...collections }; delete absent.Billings; assert.equal(inspectEmployeeReferences({ companyId: "company", collections: absent }).consistent, false);
  collections.OperationResults[0].raw.employeeIds = []; assert.equal(inspectEmployeeReferences({ companyId: "company", collections }).consistent, false);
  const called = []; await assert.rejects(runEmployeeReferenceDryRun({ companyId: "company", readCollection: async (companyId, collection) => { called.push([companyId, collection]); throw new Error("read failed"); } })); assert.deepEqual(called, [["company", "SiteOperationSchedules"]]);
});

test("dry-run validates each of six raw collection shapes and rejects hidden mirror references", () => {
  const raw = operation(["a"]), schedule = { ...operation([]), docId: "schedule" };
  const notification = { ...raw.employees[0], docId: "schedule_a", siteOperationScheduleId: "schedule", notificationKey: "schedule_a" };
  const daily = { docId: "a_2026-09-01", employeeId: "a", operationResults: [raw], operationResultIds: [raw.docId], employeeIds: ["a"] };
  const values = { SiteOperationSchedules: schedule, OperationResults: raw, ArrangementNotifications: notification, DailyAttendances: daily, DailyOperationsByEmployee: daily, Billings: { docId: "customer_site_2026-09-01", operationResults: [raw], employeeIds: ["a"] } };
  const make = () => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, [{ id: value.docId, raw: { ...value } }]]));
  assert.equal(inspectEmployeeReferences({ companyId: "company", collections: make() }).consistent, true);
  for (const name of EMPLOYEE_REFERENCE_COLLECTIONS) {
    const collections = make(), value = collections[name][0].raw;
    if (name === "ArrangementNotifications") delete value.workerId; else delete value.employeeIds;
    const report = inspectEmployeeReferences({ companyId: "company", collections });
    assert.equal(report.consistent, false, name); assert.equal(report.archiveReady, false); assert.deepEqual(report.issues, [{ collection: name, reason: "invalid-reference-data" }]);
  }
  const collections = make(); collections.OperationResults[0].raw.workers = [...raw.workers, { ...raw.workers[0], id: "hidden" }];
  assert.equal(inspectEmployeeReferences({ companyId: "company", collections }).consistent, false);
  const wrongTenant = make(); wrongTenant.Billings[0].raw.companyId = "other";
  assert.equal(inspectEmployeeReferences({ companyId: "company", collections: wrongTenant }).consistent, false);
});

test("old Employee deletion events have no User/Auth read or write effects", async () => {
  const source = await readFile(new URL("../../functions/modules/Employees.js", import.meta.url), "utf8");
  let handler, reads = 0, writes = 0;
  const User = class { constructor() { reads++; } fetchDocs() { reads++; } delete() { writes++; } };
  const code = source.replace(/import[\s\S]*?;\s*/gu, "").replace("export const", "const");
  new Function("onDocumentDeleted", "User", "getAuth", `${code};`)((path, callback) => { assert.equal(path, "Companies/{companyId}/Employees/{docId}"); handler = callback; }, User, () => { reads++; return { deleteUser() { writes++; } }; });
  await handler({ params: { companyId: "company", docId: "a" }, data: { data: () => { reads++; return {}; } } });
  assert.equal(reads, 0); assert.equal(writes, 0); assert.doesNotMatch(source, /from ["'](?:.*auth|.*schemas)/u);
});
