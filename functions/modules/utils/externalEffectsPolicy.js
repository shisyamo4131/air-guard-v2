export const CODEX_LOCAL_PROJECT_ID = "demo-air-guard-v2-codex";

export const EXTERNAL_EFFECTS_ERROR_CODES = Object.freeze({
  EFFECT_REQUIRED: "external-effects/effect-required",
  INVALID_MODE: "external-effects/invalid-mode",
  CODEX_PROJECT_REQUIRES_EMULATOR:
    "external-effects/codex-project-requires-emulator",
  CODEX_PROJECT_REQUIRES_DENY:
    "external-effects/codex-project-requires-deny",
  EXTERNAL_EFFECT_BLOCKED: "external-effects/blocked",
});

const EXTERNAL_EFFECTS_MODES = Object.freeze({
  ALLOW: "allow",
  DENY: "deny",
  INHERIT: "inherit",
});

export class ExternalEffectsPolicyError extends Error {
  constructor(code, message, { effect } = {}) {
    super(message);
    this.name = "ExternalEffectsPolicyError";
    this.code = code;
    if (effect !== undefined) this.effect = effect;
  }
}

function resolveConfiguredMode(environment) {
  const configuredMode = environment.AIR_GUARD_EXTERNAL_EFFECTS;
  if (configuredMode === undefined) return EXTERNAL_EFFECTS_MODES.INHERIT;

  if (
    configuredMode !== EXTERNAL_EFFECTS_MODES.ALLOW &&
    configuredMode !== EXTERNAL_EFFECTS_MODES.DENY
  ) {
    throw new ExternalEffectsPolicyError(
      EXTERNAL_EFFECTS_ERROR_CODES.INVALID_MODE,
      "AIR_GUARD_EXTERNAL_EFFECTS must be either allow or deny.",
    );
  }

  return configuredMode;
}

export function resolveExternalEffectsPolicy(environment = process.env) {
  const projectId = environment.GCLOUD_PROJECT;
  const functionsEmulator = environment.FUNCTIONS_EMULATOR === "true";
  const mode = resolveConfiguredMode(environment);

  if (projectId === CODEX_LOCAL_PROJECT_ID) {
    if (!functionsEmulator) {
      throw new ExternalEffectsPolicyError(
        EXTERNAL_EFFECTS_ERROR_CODES.CODEX_PROJECT_REQUIRES_EMULATOR,
        "The dedicated Codex project may run Functions only in the Emulator.",
      );
    }
    if (mode !== EXTERNAL_EFFECTS_MODES.DENY) {
      throw new ExternalEffectsPolicyError(
        EXTERNAL_EFFECTS_ERROR_CODES.CODEX_PROJECT_REQUIRES_DENY,
        "The dedicated Codex project must deny external effects.",
      );
    }
  }

  return Object.freeze({
    projectId,
    functionsEmulator,
    mode,
    externalEffectsAllowed: mode !== EXTERNAL_EFFECTS_MODES.DENY,
  });
}

export function assertExternalEffectAllowed(effect, environment = process.env) {
  if (typeof effect !== "string" || effect.trim() !== effect || effect === "") {
    throw new ExternalEffectsPolicyError(
      EXTERNAL_EFFECTS_ERROR_CODES.EFFECT_REQUIRED,
      "A non-empty normalized external effect name is required.",
    );
  }

  const policy = resolveExternalEffectsPolicy(environment);
  if (!policy.externalEffectsAllowed) {
    throw new ExternalEffectsPolicyError(
      EXTERNAL_EFFECTS_ERROR_CODES.EXTERNAL_EFFECT_BLOCKED,
      `External effect is blocked: ${effect}`,
      { effect },
    );
  }

  return policy;
}
