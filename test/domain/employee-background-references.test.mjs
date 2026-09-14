import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { OperationResult, DailyAttendance, DailyOperationByEmployee, Billing, Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp, FieldValue } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import { parseDate, encodeExpected } from "../../functions/shared/employeeContract.js";
import { syncOperationResultToDailyAttendances } from "../../functions/modules/dailyAttendances/index.js";
import { syncOperationResultToDailyOperationsByEmployee } from "../../functions/modules/dailyOperationsByEmployee/index.js";
import { fetchDailyTargets, changeDailyResults, saveDailyTargets } from "../../functions/modules/employees/dailyReferencePlan.js";
import { addOperationResultToBilling, removeOperationResultFromBilling, syncOperationResultToBilling } from "../../functions/modules/billings/index.js";
import { rebuildHistory } from "../../functions/modules/siteEmployeeHistories/rebuildHistory.js";
import { rebuildAllHistories } from "../../functions/modules/siteEmployeeHistories/rebuildAllHistories.js";

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
  assert.equal(retry.employeeReads().length, 0, "transaction projections do not require live Employee masters");
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
  test(`${collection}: new ten-person raw aggregate does not read Employee masters and preserves source snapshots`, async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `employee-${i}`), raw = operation(ids), state = runtime({ employees: ids });
    raw.unknown = { stamp: new Timestamp(1788200000, 123456789), optional: null }; raw.employees[0].unknown = { retained: true };
    await sync({ companyId: "company", afterData: raw, firestore: state.firestore });
    assert.equal(state.employeeReads().length, 0); assert.equal(state.writes.length, 10);
    for (const id of ids) { const saved = state.data.get(`${root}/${collection}/${id}_2026-09-01`); assert.equal(Object.hasOwn(saved, "employeeIds"), false); assert.strictEqual(saved.operationResults[0], raw); }
    state.events.length = 0; const path = `${root}/${collection}/${ids[0]}_2026-09-01`, current = state.data.get(path); current.unknown = { stamp: raw.unknown.stamp, nullable: null }; delete current.remarks;
    const after = { ...raw, remarks: "corrected" }; await sync({ companyId: "company", beforeData: raw, afterData: after, firestore: state.firestore });
    assert.equal(state.employeeReads().length, 0); assert.strictEqual(state.data.get(path).unknown.stamp, raw.unknown.stamp); assert.equal(Object.hasOwn(state.data.get(path), "remarks"), false);
    state.events.length = 0; await sync({ companyId: "company", beforeData: after, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.equal(state.data.has(path), false);
  });
  test(`${collection}: a same-destination replacement does not read embedded Employee masters`, async () => {
    const before = operation(), state = runtime(); await sync({ companyId: "company", afterData: before, firestore: state.firestore }); state.events.length = 0;
    const after = operation(["a", "c"]);
    await state.firestore.runTransaction(async (transaction) => {
      const entries = await fetchDailyTargets({ companyId: "company", operationResult: before, transaction, attendance, firestore: state.firestore });
      const selected = entries.filter(({ instance }) => instance.employeeId === "a");
      changeDailyResults(selected, after, attendance); await saveDailyTargets({ companyId: "company", entries: selected, transaction, attendance, firestore: state.firestore });
    });
    assert.deepEqual(state.employeeReads(), []); assert.equal(Object.hasOwn(state.data.get(`${root}/${collection}/a_2026-09-01`), "employeeIds"), false);
  });
  test(`${collection}: move and late event succeed even when an embedded Employee master is absent`, async () => {
    const before = operation(), state = runtime(); await sync({ companyId: "company", afterData: before, firestore: state.firestore });
    state.data.delete(`${root}/Employees/b`); state.writes.length = 0;
    const after = operation(["a", "b"], "2026-09-02");
    await sync({ companyId: "company", beforeData: before, afterData: after, firestore: state.firestore }); assert.ok(state.writes.length > 0);
    state.data.delete(`${root}/${collection}/a_2026-09-01`);
    state.writes.length = 0;
    await sync({ companyId: "company", beforeData: before, afterData: before, firestore: state.firestore }); assert.ok(state.writes.length > 0);
  });
  test(`${collection}: obsolete aggregate employeeIds are ignored and removed on the next projection write`, async () => {
    const raw = operation(), state = runtime(); await sync({ companyId: "company", afterData: raw, firestore: state.firestore }); state.writes.length = 0;
    const saved = state.data.get(`${root}/${collection}/a_2026-09-01`);
    saved.employeeIds = ["stale"];
    await sync({ companyId: "company", beforeData: raw, afterData: { ...raw, remarks: "rewrite" }, firestore: state.firestore });
    assert.equal(Object.hasOwn(state.data.get(`${root}/${collection}/a_2026-09-01`), "employeeIds"), false);
  });
}

test("Billing never reads Employee masters and preserves unrelated stored fields", async () => {
  const ids = Array.from({ length: 10 }, (_, i) => `employee-${i}`), raw = operation(ids), state = runtime({ employees: [...ids, "new"] });
  await addOperationResultToBilling({ companyId: "company", doc: raw, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0);
  const path = `${root}/Billings/customer_site_2026-09-01`, initial = state.data.get(path), nano = new Timestamp(1788200000, 123456789); initial.unknown = { nano, nil: null }; initial.paymentDueDateAt = nano;
  state.events.length = 0; await syncOperationResultToBilling({ companyId: "company", before: raw, after: { ...raw, remarks: "changed" }, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.strictEqual(state.data.get(path).paymentDueDateAt, nano);
  state.events.length = 0; const replaced = operation([...ids.slice(0, 9), "new"]); await syncOperationResultToBilling({ companyId: "company", before: raw, after: replaced, firestore: state.firestore }); assert.deepEqual(state.employeeReads(), []); assert.strictEqual(state.data.get(path).unknown.nano, nano);
  state.events.length = 0; await removeOperationResultFromBilling({ companyId: "company", operationResult: replaced, firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.equal(state.data.has(path), false);
});

test("Billing move and late recreation succeed without embedded Employee masters", async () => {
  const before = operation(), after = operation(["a", "b"], "2026-09-02"), state = runtime(); await addOperationResultToBilling({ companyId: "company", doc: before, firestore: state.firestore });
  state.data.delete(`${root}/Employees/b`); state.writes.length = 0;
  await syncOperationResultToBilling({ companyId: "company", before, after, firestore: state.firestore }); assert.equal(state.data.has(`${root}/Billings/customer_site_2026-09-02`), true);
  state.data.delete(`${root}/Billings/customer_site_2026-09-01`);
  state.writes.length = 0;
  await syncOperationResultToBilling({ companyId: "company", before, after: before, firestore: state.firestore }); assert.equal(state.data.has(`${root}/Billings/customer_site_2026-09-01`), true);
});

test("history keeps nanos and can be rebuilt after Employee master removal", async () => {
  const first = operation(), last = operation(["a", "b"], "2026-09-12", { docId: "last" }), state = runtime({ records: [[`${root}/OperationResults/operation`, first], [`${root}/OperationResults/last`, last]] });
  await rebuildHistory("company", "site", "a", { firestore: state.firestore });
  const path = `${root}/SiteEmployeeHistories/site_a`, raw = state.data.get(path); assert.equal(raw.firstDateAt.toDate().toISOString(), "2026-08-31T15:00:00.000Z"); assert.equal(raw.lastDateAt.toDate().toISOString(), "2026-09-11T15:00:00.000Z");
  const nano = new Timestamp(raw.firstDateAt.seconds, 123456789); raw.firstDateAt = nano; raw.unknown = { nano }; state.events.length = 0;
  await rebuildHistory("company", "site", "a", { firestore: state.firestore }); assert.equal(state.employeeReads().length, 0); assert.strictEqual(state.data.get(path).firstDateAt, nano);
  state.data.delete(path); state.data.delete(`${root}/Employees/a`); state.writes.length = 0;
  await rebuildHistory("company", "site", "a", { firestore: state.firestore }); assert.equal(state.data.has(path), true);
  state.writes.length = 0;
  first.employeeIds = []; await assert.rejects(rebuildAllHistories("company", { firestore: state.firestore })); assert.equal(state.writes.length, 0);
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
