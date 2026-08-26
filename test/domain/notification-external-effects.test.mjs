import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTERNAL_EFFECTS_ERROR_CODES,
  ExternalEffectsPolicyError,
} from "../../functions/modules/utils/externalEffectsPolicy.js";
import {
  sendBatchNotifications,
  sendMulticastNotification,
  sendNotification,
} from "../../functions/modules/utils/notifications.js";

function useDedicatedFailClosedEnvironment() {
  const originalEnvironment = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
    AIR_GUARD_EXTERNAL_EFFECTS: process.env.AIR_GUARD_EXTERNAL_EFFECTS,
  };

  process.env.GCLOUD_PROJECT = "demo-air-guard-v2-codex";
  process.env.FUNCTIONS_EMULATOR = "true";
  process.env.AIR_GUARD_EXTERNAL_EFFECTS = "deny";

  return () => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

async function assertBlocked(run, effect) {
  await assert.rejects(run(), (error) => {
    assert.ok(error instanceof ExternalEffectsPolicyError);
    assert.equal(
      error.code,
      EXTERNAL_EFFECTS_ERROR_CODES.EXTERNAL_EFFECT_BLOCKED,
    );
    assert.equal(error.effect, effect);
    return true;
  });
}

test("dedicated Codex mode blocks every FCM adapter entrypoint", async () => {
  const restoreEnvironment = useDedicatedFailClosedEnvironment();

  try {
    await assertBlocked(
      () =>
        sendNotification("synthetic-token", {
          title: "Synthetic",
          body: "Single",
        }),
      "fcm.send",
    );
    await assertBlocked(
      () =>
        sendMulticastNotification(["synthetic-token"], {
          title: "Synthetic",
          body: "Multicast",
        }),
      "fcm.send-multicast",
    );
    await assertBlocked(
      () =>
        sendBatchNotifications([
          {
            token: "synthetic-token",
            notification: { title: "Synthetic", body: "Batch" },
          },
        ]),
      "fcm.send-batch",
    );
  } finally {
    restoreEnvironment();
  }
});
