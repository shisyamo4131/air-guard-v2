import test from "node:test";
import assert from "node:assert/strict";
import { SiteOperationSchedule, ArrangementNotification } from "@shisyamo4131/air-guard-v2-schemas";
import { operationEmployeeReferences, notificationEmployeeReferences } from "../../functions/shared/operationReferences.js";

function schedule(ids = ["employee-a", "employee-b"]) {
  const model = new SiteOperationSchedule({ docId: "schedule", siteId: "site", dateAt: new Date("2026-09-01T00:00:00+09:00") });
  for (const id of ids) model.addWorker({ id, isEmployee: true }, -1);
  model.addWorker({ id: "outsourcer", isEmployee: false }, -1);
  return model.toObject();
}

test("raw identity, arrays, and stored indexes are rejected before Class coercion", () => {
  const raw = schedule();
  const malformed = [
    { ...raw, employees: null }, { ...raw, employeeIds: undefined },
    { ...raw, employeeIds: ["employee-b", "employee-a"] },
    { ...raw, outsourcerIds: [] },
    { ...raw, workers: [...raw.workers, raw.workers[0]] },
    { ...raw, workers: [{ ...raw.workers[0], id: "hidden", employeeId: "hidden", workerId: "hidden" }, ...raw.workers.slice(1)] },
    ...[
      { isEmployee: false }, { isEmployee: "true" }, { id: "bad/id" },
      { employeeId: "someone-else" }, { outsourcerId: "outsourcer" },
      { workerId: "someone-else" }, { index: "0" }, { amount: 2 }, { siteId: "other-site" },
      { isQualified: "false" }, { breakMinutes: "60" }, { dateAt: "2026-09-01" },
    ].map((changes) => ({ ...raw, employees: [{ ...raw.employees[0], ...changes }, raw.employees[1]] })),
  ];
  for (const item of malformed) assert.throws(() => operationEmployeeReferences(item), { code: "failed-precondition" });
  assert.throws(() => operationEmployeeReferences(raw, { scheduleId: "other-schedule" }), { code: "failed-precondition" });
});

test("notification reference must agree with its worker kind and derived document ID", () => {
  const raw = schedule();
  for (const worker of [...raw.employees, ...raw.outsourcers]) {
    const notification = new ArrangementNotification(worker).toObject();
    notification.docId = worker.notificationKey;
    assert.deepEqual([...notificationEmployeeReferences(notification)], worker.isEmployee ? [worker.id] : []);
    assert.throws(() => notificationEmployeeReferences({ ...notification, docId: "another-notification" }), { code: "failed-precondition" });
    assert.throws(() => notificationEmployeeReferences({ ...notification, isEmployee: !worker.isEmployee }), { code: "failed-precondition" });
  }
});
