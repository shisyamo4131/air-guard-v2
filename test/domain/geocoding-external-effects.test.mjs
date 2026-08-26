import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTERNAL_EFFECTS_ERROR_CODES,
  ExternalEffectsPolicyError,
} from "../../functions/modules/utils/externalEffectsPolicy.js";
import { fetchCoordinates } from "../../functions/modules/utils/geocoding.js";

test("dedicated Codex mode blocks Geocoding before fetch is called", async () => {
  const originalEnvironment = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
    AIR_GUARD_EXTERNAL_EFFECTS: process.env.AIR_GUARD_EXTERNAL_EFFECTS,
  };
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  process.env.GCLOUD_PROJECT = "demo-air-guard-v2-codex";
  process.env.FUNCTIONS_EMULATOR = "true";
  process.env.AIR_GUARD_EXTERNAL_EFFECTS = "deny";
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch must not be called");
  };

  try {
    await assert.rejects(fetchCoordinates("東京都千代田区"), (error) => {
      assert.ok(error instanceof ExternalEffectsPolicyError);
      assert.equal(
        error.code,
        EXTERNAL_EFFECTS_ERROR_CODES.EXTERNAL_EFFECT_BLOCKED,
      );
      assert.equal(error.effect, "geocoding.fetch");
      return true;
    });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
