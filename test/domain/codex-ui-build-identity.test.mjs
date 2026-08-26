import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CODEX_UI_BUILD_IDENTITY,
  assertCodexUiBuildIdentity,
  assertCodexUiBuildIdentityMatches,
  readDedicatedConfigFingerprint,
} from "../../scripts/codex-local-ui-build-identity.mjs";

async function dedicatedProject(t) {
  const root = await mkdtemp(join(tmpdir(), "airguard-codex-ui-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "config"));
  await writeFile(
    join(root, "config", "codex-test-ui.env"),
    [
      "NUXT_PUBLIC_FIREBASE_USE_EMULATOR=true",
      "NUXT_PUBLIC_FIREBASE_API_KEY=codex-local-only",
      "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-air-guard-v2-codex.localhost",
      "NUXT_PUBLIC_FIREBASE_DATABASE_URL=http://127.0.0.1:19000?ns=demo-air-guard-v2-codex",
      "NUXT_PUBLIC_FIREBASE_PROJECT_ID=demo-air-guard-v2-codex",
      "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-air-guard-v2-codex.appspot.com",
      "NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000",
      "NUXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:codex-local",
      "NUXT_PUBLIC_FIREBASE_REGION=asia-northeast1",
      "NUXT_PUBLIC_FIREBASE_VAPID_KEY=",
      "NUXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1",
      "NUXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT=19099",
      "NUXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT=18080",
      "NUXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_PORT=19000",
      "NUXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT=19199",
      "NUXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT=15001",
      "",
    ].join("\n"),
  );
  return root;
}

test("dedicated config fingerprint accepts only the pinned local values", async (t) => {
  const root = await dedicatedProject(t);
  assert.match(await readDedicatedConfigFingerprint(root), /^[0-9a-f]{64}$/);

  await writeFile(
    join(root, "config", "codex-test-ui.env"),
    "NUXT_PUBLIC_FIREBASE_PROJECT_ID=air-guard-v2-dev\n",
  );
  await assert.rejects(
    readDedicatedConfigFingerprint(root),
    /not fail-closed/,
  );
});

test("build identity validation rejects a missing identity before git access", async () => {
  await assert.rejects(
    assertCodexUiBuildIdentity("unused", undefined),
    /identity is missing/,
  );
});

test("build identity constants pin the dedicated project and effect denial", () => {
  assert.deepEqual(CODEX_UI_BUILD_IDENTITY, {
    schemaVersion: 1,
    kind: "air-guard-v2-codex-local-ui",
    projectId: "demo-air-guard-v2-codex",
    externalEffects: "deny",
  });
});

test("build identity rejects stale source and config fingerprints", () => {
  const expected = {
    ...CODEX_UI_BUILD_IDENTITY,
    configSha256: "a".repeat(64),
    sourceHead: "b".repeat(40),
  };

  assert.throws(
    () =>
      assertCodexUiBuildIdentityMatches(expected, {
        ...expected,
        sourceHead: "c".repeat(40),
      }),
    /sourceHead/,
  );
  assert.throws(
    () =>
      assertCodexUiBuildIdentityMatches(expected, {
        ...expected,
        configSha256: "d".repeat(64),
      }),
    /configSha256/,
  );
  assert.throws(
    () =>
      assertCodexUiBuildIdentityMatches(expected, {
        ...expected,
        unexpected: true,
      }),
    /schema mismatch/,
  );
});

test("dedicated build command writes identity only after a successful build", async () => {
  const source = await readFile(
    new URL("../../scripts/build-codex-local-ui.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /createCodexUiBuildIdentity/);
  assert.match(source, /"build", "--dotenv", "config\/codex-test-ui\.env"/);
  assert.match(source, /AIR_GUARD_EXTERNAL_EFFECTS: "deny"/);
  assert.match(source, /\.output/);
  assert.match(source, /server\/index\.mjs/);
  assert.match(source, /Source identity changed while building/);
  assert.match(source, /flag: "wx"/);
  assert.doesNotMatch(source, /shell:\s*true|https:\/\//);
});
