import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const CODEX_UI_BUILD_IDENTITY = Object.freeze({
  schemaVersion: 1,
  kind: "air-guard-v2-codex-local-ui",
  projectId: "demo-air-guard-v2-codex",
  externalEffects: "deny",
});

export const CODEX_UI_BUILD_IDENTITY_FILE =
  "codex-local-ui-build-identity.json";

const DEDICATED_PUBLIC_CONFIG = Object.freeze({
  NUXT_PUBLIC_FIREBASE_USE_EMULATOR: "true",
  NUXT_PUBLIC_FIREBASE_API_KEY: "codex-local-only",
  NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-air-guard-v2-codex.localhost",
  NUXT_PUBLIC_FIREBASE_DATABASE_URL:
    "http://127.0.0.1:19000?ns=demo-air-guard-v2-codex",
  NUXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-air-guard-v2-codex",
  NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    "demo-air-guard-v2-codex.appspot.com",
  NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NUXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:codex-local",
  NUXT_PUBLIC_FIREBASE_REGION: "asia-northeast1",
  NUXT_PUBLIC_FIREBASE_VAPID_KEY: "",
  NUXT_PUBLIC_FIREBASE_EMULATOR_HOST: "127.0.0.1",
  NUXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: "19099",
  NUXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT: "18080",
  NUXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_PORT: "19000",
  NUXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT: "19199",
  NUXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT: "15001",
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readDedicatedConfigFingerprint(projectRoot) {
  const configPath = resolve(projectRoot, "config/codex-test-ui.env");
  const config = await readFile(configPath, "utf8");
  const values = new Map();
  for (const line of config.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) {
      throw new Error("Dedicated UI build configuration is not fail-closed.");
    }
    const name = trimmed.slice(0, separator);
    if (values.has(name)) {
      throw new Error("Dedicated UI build configuration is not fail-closed.");
    }
    values.set(name, trimmed.slice(separator + 1));
  }

  if (
    values.size !== Object.keys(DEDICATED_PUBLIC_CONFIG).length ||
    Object.entries(DEDICATED_PUBLIC_CONFIG).some(
      ([name, value]) => values.get(name) !== value,
    )
  ) {
    throw new Error("Dedicated UI build configuration is not fail-closed.");
  }

  return sha256(config);
}

export async function createDedicatedUiEnvironment(
  projectRoot,
  inheritedEnv = process.env,
) {
  await readDedicatedConfigFingerprint(projectRoot);
  const dedicated = {
    ...DEDICATED_PUBLIC_CONFIG,
    AIR_GUARD_EXTERNAL_EFFECTS: "deny",
  };
  const environment = { ...inheritedEnv };
  for (const [name, value] of Object.entries(inheritedEnv)) {
    const canonicalName = name.toUpperCase();
    // Nitro prioritizes NITRO_ over NUXT_ and accepts whole-object overrides.
    // Do not allow alternate config or expansion controls around the allowlist.
    if (
      canonicalName.startsWith("NITRO_PUBLIC_FIREBASE_") ||
      [
        "NITRO_PUBLIC", "NUXT_PUBLIC",
        "NITRO_ENV_PREFIX", "NITRO_ENV_EXPANSION",
        "NITRO_NITRO", "NUXT_NITRO",
        "NITRO_NITRO_ENV_PREFIX", "NUXT_NITRO_ENV_PREFIX",
        "NITRO_NITRO_ENV_EXPANSION", "NUXT_NITRO_ENV_EXPANSION",
      ].includes(canonicalName)
    ) {
      throw new Error("Inherited environment conflicts with dedicated UI isolation.");
    }
    if (
      !canonicalName.startsWith("NUXT_PUBLIC_FIREBASE_") &&
      canonicalName !== "AIR_GUARD_EXTERNAL_EFFECTS"
    ) continue;
    if (
      !Object.hasOwn(dedicated, canonicalName) ||
      (value !== undefined && value !== dedicated[canonicalName])
    ) {
      throw new Error("Inherited environment conflicts with dedicated UI isolation.");
    }
    delete environment[name];
  }
  return { ...environment, ...dedicated };
}

export function readCleanGitIdentity(projectRoot) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
    }).trim();

  const sourceHead = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  if (!/^[0-9a-f]{40}$/.test(sourceHead) || status !== "") {
    throw new Error("Dedicated UI build requires a clean committed source tree.");
  }
  return sourceHead;
}

export async function createCodexUiBuildIdentity(projectRoot) {
  return {
    ...CODEX_UI_BUILD_IDENTITY,
    configSha256: await readDedicatedConfigFingerprint(projectRoot),
    sourceHead: readCleanGitIdentity(projectRoot),
  };
}

export async function assertCodexUiBuildIdentity(projectRoot, identity) {
  if (!identity || typeof identity !== "object") {
    throw new Error("Dedicated UI build identity is missing.");
  }

  const expected = await createCodexUiBuildIdentity(projectRoot);
  return assertCodexUiBuildIdentityMatches(expected, identity);
}

export function assertCodexUiBuildIdentityMatches(expected, identity) {
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    Object.keys(identity).length !== Object.keys(expected).length
  ) {
    throw new Error("Dedicated UI build identity schema mismatch.");
  }
  for (const [name, value] of Object.entries(expected)) {
    if (identity[name] !== value) {
      throw new Error(`Dedicated UI build identity mismatch: ${name}.`);
    }
  }
  return expected;
}
