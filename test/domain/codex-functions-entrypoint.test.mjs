import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const PUBLIC_CALLABLES = [
  "archiveCustomer",
  "archiveSite",
  "changeAdminUser",
  "checkEmailAvailability",
  "checkUserPreRegistration",
  "createAdminAccount",
  "createEmployee",
  "updateEmployeeBasic",
  "updateEmployeeNationality",
  "updateEmployeeSecurity",
  "updateEmployeeCertifications",
  "transitionEmployeeInsurance",
  "createEmployeeLinkedTemporaryUser",
  "createStandaloneTemporaryUser",
  "deleteStandaloneRegisteredUser",
  "deleteTemporaryUser",
  "disableUser",
  "enableUser",
  "getEmployeeReinstatementContext",
  "listLifecycleOperations",
  "rebuildAllHistories",
  "rebuildSecurityReportIndexes",
  "reactivateSite",
  "reinstateEmployee",
  "setupUserAccount",
  "saveOperation",
  "terminateEmployee",
  "terminateSite",
  "updateCompanyArrangement",
  "updateCompanyBilling",
  "updateCompanyOperations",
  "updateCompanyProfile",
  "updateBillingPaymentDate",
  "updateOwnUserProfile",
  "updateSiteAgreements",
  "updateUserNotificationSettings",
  "updateUserRoles",
];

test("dedicated Functions entrypoint exports Callables and one execution-gated operation trigger", async () => {
  const originalEnvironment = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
    AIR_GUARD_EXTERNAL_EFFECTS: process.env.AIR_GUARD_EXTERNAL_EFFECTS,
  };

  process.env.GCLOUD_PROJECT = "demo-air-guard-v2-codex";
  process.env.FUNCTIONS_EMULATOR = "true";
  delete process.env.AIR_GUARD_EXTERNAL_EFFECTS;

  try {
    const entrypoint = await import(
      `../../functions/codex-test/index.js?test=${Date.now()}`
    );

    assert.equal(process.env.AIR_GUARD_EXTERNAL_EFFECTS, "deny");
    assert.deepEqual(Object.keys(entrypoint).sort(), [...PUBLIC_CALLABLES, "codexOnOperationResultChange"].sort());
    for (const forbiddenExport of [
      "geocoding",
      "onNotificationCreated",
      "onArrangementNotificationCreated",
      "onOperationResultChanged",
      "webhooks",
    ]) {
      assert.equal(forbiddenExport in entrypoint, false);
    }
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("dedicated operation trigger is execution-off by default and requires every local boundary", async () => {
  const source = await readFile(new URL("../../functions/codex-test/operationResultTrigger.js", import.meta.url), "utf8");
  const code = source.replace(/^import .*;\r?\n/gmu, "").replaceAll("export ", "");
  let callback, calls = 0;
  const environment = {};
  const enabled = new Function("onDocumentWritten", "onOperationResultChange", "process", `${code}; return codexOperationResultEnabled;`)(
    (path, handler) => { assert.equal(path, "Companies/{companyId}/OperationResults/{docId}"); callback = handler; },
    { run: async (event) => { calls++; assert.equal(event.marker, "owned"); } }, { env: environment },
  );
  await callback(new Proxy({}, { get() { throw new Error("off must not consume the event"); } }));
  assert.equal(calls, 0);
  const valid = { AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER: "enabled", GCLOUD_PROJECT: "demo-air-guard-v2-codex", FUNCTIONS_EMULATOR: "true", AIR_GUARD_EXTERNAL_EFFECTS: "deny", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" };
  for (const field of Object.keys(valid).filter((field) => field !== "AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER")) {
    assert.throws(() => enabled({ ...valid, [field]: "invalid" }));
  }
  Object.assign(environment, valid); await callback({ marker: "owned" }); assert.equal(calls, 1);
});
