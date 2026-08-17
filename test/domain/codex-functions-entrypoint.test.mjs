import assert from "node:assert/strict";
import test from "node:test";

const PUBLIC_CALLABLES = [
  "changeAdminUser",
  "checkEmailAvailability",
  "checkEmailAvailabilityGlobal",
  "checkUserPreRegistration",
  "createAdminAccount",
  "deleteTemporaryUser",
  "disableUser",
  "enableUser",
  "rebuildAllHistories",
  "rebuildSecurityReportIndexes",
  "setupUserAccount",
];

test("dedicated Functions entrypoint exports Callables without background triggers", async () => {
  const originalEnvironment = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
    AIR_GUARD_EXTERNAL_EFFECTS: process.env.AIR_GUARD_EXTERNAL_EFFECTS,
  };

  process.env.GCLOUD_PROJECT = "demo-air-guard-v2-codex";
  process.env.FUNCTIONS_EMULATOR = "true";
  process.env.AIR_GUARD_EXTERNAL_EFFECTS = "deny";

  try {
    const entrypoint = await import(
      `../../functions/codex-test/index.js?test=${Date.now()}`
    );

    assert.deepEqual(Object.keys(entrypoint).sort(), PUBLIC_CALLABLES.sort());
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
