import assert from "node:assert/strict";
import test from "node:test";
import { attachSiteScheduleConfirmation, clearSiteScheduleConfirmation, SITE_SCHEDULE_CONFIRMATION, createSiteOperationScheduleWriter } from "../../utils/siteOperationSchedule/siteScheduleGuard.js";

// Revision/status/8-Site/atomicity behavior is exercised against saveOperation
// in operation-write.test.mjs. Prompt lifetime and destination-only confirmation
// are exercised against useOperationSubmission/useOperationEditor.
test("legacy Schedule SDK writer rejects all four entry points without invoking displayed Class persistence", async () => {
  let calls = 0;
  const model = { create: () => { calls++; }, update: () => { calls++; } };
  const writer = createSiteOperationScheduleWriter();
  for (const method of ["create", "createMany", "update", "updateMany"])
    await assert.rejects(writer[method](method.endsWith("Many") ? [model] : model), { code: "dedicated-operation-required" });
  assert.equal(calls, 0);
});

test("legacy Schedule and Result handlers refuse create/update/delete without invoking model persistence", async () => {
  for (const path of ["../../handlers/siteOperationScheduleHandlers.js", "../../handlers/operationResultHandlers.js"]) {
    const handlers = await import(path); let calls = 0;
    const model = { create() { calls++; }, update() { calls++; }, delete() { calls++; } };
    for (const method of ["handleCreate", "handleUpdate", "handleDelete"]) await assert.rejects(handlers[method](model), /専用/u);
    assert.equal(calls, 0);
  }
});

test("Site selection confirmation remains local to a tenant/operation, is not serialized, and clears explicitly", () => {
  const model = { docId: "operation" };
  const confirmation = attachSiteScheduleConfirmation(model, { companyId: "company", siteId: "site", operationId: "attempt" });
  assert.equal(confirmation.companyId, "company"); assert.equal(confirmation.siteId, "site"); assert.equal(confirmation.operationId, "attempt"); assert.equal(confirmation.status, "TERMINATED");
  assert.equal(Object.isFrozen(confirmation), true); assert.strictEqual(model[SITE_SCHEDULE_CONFIRMATION], confirmation);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), { docId: "operation" });
  clearSiteScheduleConfirmation(model); assert.equal(model[SITE_SCHEDULE_CONFIRMATION], undefined);
  assert.throws(() => attachSiteScheduleConfirmation(model, { companyId: "", siteId: "site", operationId: "attempt" }), { code: "invalid-confirmation" });
});
