import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExternalEffectAllowed,
  EXTERNAL_EFFECTS_ERROR_CODES,
  ExternalEffectsPolicyError,
  resolveExternalEffectsPolicy,
} from "../../functions/modules/utils/externalEffectsPolicy.js";

const CODEX_PROJECT_ID = "demo-air-guard-v2-codex";

function codexEnvironment(overrides = {}) {
  return {
    GCLOUD_PROJECT: CODEX_PROJECT_ID,
    FUNCTIONS_EMULATOR: "true",
    AIR_GUARD_EXTERNAL_EFFECTS: "deny",
    ...overrides,
  };
}

function assertPolicyError(run, code) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof ExternalEffectsPolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("dedicated Codex Functions require the exact local fail-closed configuration", () => {
  const policy = resolveExternalEffectsPolicy(codexEnvironment());

  assert.deepEqual(policy, {
    projectId: CODEX_PROJECT_ID,
    functionsEmulator: true,
    mode: "deny",
    externalEffectsAllowed: false,
  });
  assert.equal(Object.isFrozen(policy), true);
});

test("dedicated Codex project is rejected outside the Functions Emulator", () => {
  assertPolicyError(
    () =>
      resolveExternalEffectsPolicy(
        codexEnvironment({ FUNCTIONS_EMULATOR: undefined }),
      ),
    EXTERNAL_EFFECTS_ERROR_CODES.CODEX_PROJECT_REQUIRES_EMULATOR,
  );
});

test("dedicated Codex project is rejected unless external effects are denied", () => {
  for (const mode of [undefined, "allow"]) {
    assertPolicyError(
      () =>
        resolveExternalEffectsPolicy(
          codexEnvironment({ AIR_GUARD_EXTERNAL_EFFECTS: mode }),
        ),
      EXTERNAL_EFFECTS_ERROR_CODES.CODEX_PROJECT_REQUIRES_DENY,
    );
  }
});

test("unknown external-effect modes fail closed", () => {
  for (const mode of ["", "DENY", "blocked", " deny "]) {
    assertPolicyError(
      () =>
        resolveExternalEffectsPolicy({
          GCLOUD_PROJECT: "local-user-project",
          FUNCTIONS_EMULATOR: "true",
          AIR_GUARD_EXTERNAL_EFFECTS: mode,
        }),
      EXTERNAL_EFFECTS_ERROR_CODES.INVALID_MODE,
    );
  }
});

test("deny mode blocks named external effects before an adapter is called", () => {
  assertPolicyError(
    () => assertExternalEffectAllowed("fcm.send", codexEnvironment()),
    EXTERNAL_EFFECTS_ERROR_CODES.EXTERNAL_EFFECT_BLOCKED,
  );
});

test("an external effect name is required", () => {
  for (const effect of [undefined, null, "", " ", 1]) {
    assertPolicyError(
      () => assertExternalEffectAllowed(effect, codexEnvironment()),
      EXTERNAL_EFFECTS_ERROR_CODES.EFFECT_REQUIRED,
    );
  }
});

test("existing non-Codex environments retain legacy behavior until explicitly configured", () => {
  const inheritedPolicy = resolveExternalEffectsPolicy({
    GCLOUD_PROJECT: "air-guard-v2-dev",
  });
  const allowedPolicy = assertExternalEffectAllowed("geocoding.fetch", {
    GCLOUD_PROJECT: "air-guard-v2-dev",
    AIR_GUARD_EXTERNAL_EFFECTS: "allow",
  });

  assert.equal(inheritedPolicy.mode, "inherit");
  assert.equal(inheritedPolicy.externalEffectsAllowed, true);
  assert.equal(allowedPolicy.mode, "allow");
  assert.equal(allowedPolicy.externalEffectsAllowed, true);
});
