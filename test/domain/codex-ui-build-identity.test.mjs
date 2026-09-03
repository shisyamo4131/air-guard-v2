import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { CODEX_POSTAL_ISOLATION_RECEIPT, CODEX_POSTAL_ISOLATION_RECEIPT_FILE } from "../../scripts/vite-codex-postal-isolation.mjs";
import {
  CODEX_UI_BUILD_IDENTITY,
  CODEX_UI_BUILD_IDENTITY_FILE,
  assertCodexUiBuildIdentity,
  assertCodexUiBuildIdentityMatches,
  readDedicatedConfigFingerprint,
  createDedicatedUiEnvironment,
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

test("dedicated child environment pins config without mutating inherited environment", async (t) => {
  const root = await dedicatedProject(t);
  const inherited = { PATH: "synthetic-path" };
  assert.equal((await createDedicatedUiEnvironment(root, {})).AIR_GUARD_EXTERNAL_EFFECTS, "deny");
  const env = await createDedicatedUiEnvironment(root, inherited);
  assert.deepEqual(inherited, { PATH: "synthetic-path" });
  assert.equal(env.PATH, inherited.PATH);
  assert.equal(env.NUXT_PUBLIC_FIREBASE_PROJECT_ID, "demo-air-guard-v2-codex");
  assert.equal(env.AIR_GUARD_EXTERNAL_EFFECTS, "deny");
  const config = await readFile(join(root, "config/codex-test-ui.env"), "utf8");
  for (const line of config.trim().split(/\r?\n/)) {
    const separator = line.indexOf("=");
    assert.equal(env[line.slice(0, separator)], line.slice(separator + 1));
  }
  assert.deepEqual(await createDedicatedUiEnvironment(root, env), env);
  for (const key of Object.keys(env).filter((name) => name.startsWith("NUXT_PUBLIC_FIREBASE_"))) {
    await assert.rejects(createDedicatedUiEnvironment(root, { [key]: "synthetic-conflict" }));
  }
});

test("dedicated environment rejects conflicting and alternate overrides without leaking values", async (t) => {
  const root = await dedicatedProject(t);
  for (const key of [
    "NUXT_PUBLIC_FIREBASE_PROJECT_ID", "NUXT_PUBLIC_FIREBASE_API_KEY",
    "NUXT_PUBLIC_FIREBASE_UNKNOWN", "AIR_GUARD_EXTERNAL_EFFECTS",
    "NITRO_PUBLIC_FIREBASE_PROJECT_ID", "NITRO_PUBLIC_FIREBASE_UNKNOWN",
    "NITRO_PUBLIC", "NUXT_PUBLIC",
    "NITRO_ENV_PREFIX", "NITRO_ENV_EXPANSION", "NITRO_NITRO", "NUXT_NITRO",
    "NITRO_NITRO_ENV_PREFIX", "NUXT_NITRO_ENV_PREFIX",
    "NITRO_NITRO_ENV_EXPANSION", "NUXT_NITRO_ENV_EXPANSION",
  ]) {
    const forbidden = "synthetic-forbidden-value-never-print";
    await assert.rejects(createDedicatedUiEnvironment(root, { [key]: forbidden }), (error) => {
      assert.equal(error.message.includes(forbidden), false);
      return true;
    });
  }
});

const fixtureRoot = resolve("synthetic-launcher-fixture");
const marker = resolve(fixtureRoot, ".output", CODEX_UI_BUILD_IDENTITY_FILE);
const temporaryMarker = `${marker}.1.tmp`;
const clientReceipt = resolve(fixtureRoot, ".nuxt/dist/client", CODEX_POSTAL_ISOLATION_RECEIPT_FILE);
const outputReceipt = resolve(fixtureRoot, ".output/public", CODEX_POSTAL_ISOLATION_RECEIPT_FILE);
const serverEntry = resolve(fixtureRoot, ".output/server/index.mjs");

async function evaluateLauncher(name, overrides = {}, scenario = {}) {
  const source = await readFile(new URL(`../../scripts/${name}`, import.meta.url), "utf8");
  const events = [];
  const fakeIdentity = { synthetic: true };
  const files = new Map([[marker, JSON.stringify(fakeIdentity)], [temporaryMarker, "stale"], [clientReceipt, "stale"], [outputReceipt, "stale"]]);
  const context = {
    CODEX_UI_BUILD_IDENTITY_FILE,
    CODEX_POSTAL_ISOLATION_RECEIPT, CODEX_POSTAL_ISOLATION_RECEIPT_FILE,
    dirname, resolve,
    fileURLToPath: () => resolve(fixtureRoot, "scripts/launcher.mjs"),
    process: { env: {}, pid: 1, execPath: "synthetic-node", exit: (status) => { throw new Error(`exit ${status}`); } },
    createDedicatedUiEnvironment: async () => { events.push("environment"); return { AIR_GUARD_EXTERNAL_EFFECTS: "deny" }; },
    createCodexUiBuildIdentity: async () => fakeIdentity,
    assertCodexUiBuildIdentity: async () => {},
    rm: async (path) => {
      events.push(`remove:${path}`);
      if (scenario.removeFailure === path) throw new Error("synthetic deletion failure");
      files.delete(path);
    },
    mkdir: async () => {},
    writeFile: async (path, content) => {
      events.push(`write:${path}`);
      if (scenario.transferFailure && path === outputReceipt) throw new Error("synthetic transfer failure");
      files.set(path, content);
    },
    rename: async (from, to) => {
      assert.equal(from, temporaryMarker);
      assert.equal(to, marker);
      assert.ok(files.has(from));
      events.push("publish-marker"); files.set(to, files.get(from)); files.delete(from);
    },
    readFile: async (path) => {
      events.push(`read:${path}`);
      if (!files.has(path)) throw new Error("synthetic missing file");
      return files.get(path);
    },
    spawnSync: (_exe, _args, options) => {
      events.push("spawn");
      assert.equal(options.cwd, fixtureRoot);
      assert.equal(options.env.AIR_GUARD_EXTERNAL_EFFECTS, "deny");
      // Model Vite's actual output: no automatic copy to .output/public.
      files.set(serverEntry, "synthetic server");
      if (scenario.receipt !== null) files.set(clientReceipt, JSON.stringify(scenario.receipt ?? CODEX_POSTAL_ISOLATION_RECEIPT));
      return { status: 0 };
    },
    importServer: async () => events.push("import-server"),
    ...overrides,
  };
  const executable = source.replace(/^import[\s\S]*?from "[^"]+";\r?\n/gm, "")
    .replaceAll("import.meta.url", '"synthetic-url"')
    .replace('import("../.output/server/index.mjs")', "importServer()");
  return { events, files, promise: runInNewContext(`(async () => {${executable}\n})()`, context) };
}

test("real build and serve launchers reject environment before spawning or importing", async () => {
  for (const name of ["build-codex-local-ui.mjs", "serve-codex-local-ui.mjs"]) {
    const { events, promise } = await evaluateLauncher(name, {
      createDedicatedUiEnvironment: async () => { throw new Error("synthetic environment rejected"); },
    });
    await assert.rejects(promise, /synthetic environment rejected/);
    assert.equal(events.includes("spawn"), false);
    assert.equal(events.includes("import-server"), false);
    assert.equal(events.includes("publish-marker"), false);
  }
});

test("real generated server applies pinned environment before import", async () => {
  const fakeProcess = { env: {}, pid: 1 };
  let imports = 0;
  const { promise } = await evaluateLauncher("serve-codex-local-ui.mjs", {
    process: fakeProcess,
    createDedicatedUiEnvironment: async () => ({ NUXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-air-guard-v2-codex", AIR_GUARD_EXTERNAL_EFFECTS: "deny" }),
    importServer: async () => {
      imports++;
      assert.equal(fakeProcess.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID, "demo-air-guard-v2-codex");
      assert.equal(fakeProcess.env.NITRO_HOST, "127.0.0.1");
      assert.equal(fakeProcess.env.NITRO_PORT, "14600");
      assert.equal(fakeProcess.env.AIR_GUARD_EXTERNAL_EFFECTS, "deny");
    },
  });
  await promise;
  assert.equal(imports, 1);
});

test("real build publishes identity only after successful build and matching postal receipt", async () => {
  for (const receipt of [null, { invalid: true }, CODEX_POSTAL_ISOLATION_RECEIPT]) {
    const { events, files, promise } = await evaluateLauncher("build-codex-local-ui.mjs", {}, { receipt });
    if (receipt === CODEX_POSTAL_ISOLATION_RECEIPT) {
      await promise;
      assert.ok(events.indexOf("environment") < events.indexOf("spawn"));
      assert.ok(events.indexOf("spawn") < events.indexOf("publish-marker"));
      assert.ok(events.indexOf("spawn") < events.indexOf(`read:${clientReceipt}`));
      assert.ok(events.indexOf(`read:${clientReceipt}`) < events.indexOf(`write:${outputReceipt}`));
      assert.ok(events.indexOf(`write:${outputReceipt}`) < events.indexOf(`write:${temporaryMarker}`));
      assert.deepEqual(JSON.parse(files.get(outputReceipt)), CODEX_POSTAL_ISOLATION_RECEIPT);
    } else {
      await assert.rejects(promise, /postal isolation receipt/);
      assert.equal(events.includes("publish-marker"), false);
      assert.equal(events.includes(`write:${outputReceipt}`), false);
    }
  }
  const { events, promise } = await evaluateLauncher("build-codex-local-ui.mjs", { spawnSync: () => ({ status: 7 }) });
  await assert.rejects(promise, /exit 7/);
  assert.equal(events.includes("publish-marker"), false);
});

test("build removes exact old artifacts before spawn and stops on every deletion failure", async () => {
  const expected = [marker, temporaryMarker, outputReceipt, clientReceipt];
  const success = await evaluateLauncher("build-codex-local-ui.mjs");
  await success.promise;
  assert.deepEqual(success.events.filter((event) => event.startsWith("remove:")), expected.map((path) => `remove:${path}`));
  for (const path of expected) assert.ok(success.events.indexOf(`remove:${path}`) < success.events.indexOf("spawn"));
  for (const path of expected) {
    const { events, promise } = await evaluateLauncher("build-codex-local-ui.mjs", {}, { removeFailure: path });
    await assert.rejects(promise, /synthetic deletion failure/);
    assert.equal(events.includes("spawn"), false);
    assert.equal(events.some((event) => event.startsWith("write:")), false);
    assert.equal(events.includes("publish-marker"), false);
  }
});

test("failed client-to-public receipt transfer prevents identity publication", async () => {
  const { events, files, promise } = await evaluateLauncher("build-codex-local-ui.mjs", {}, { transferFailure: true });
  await assert.rejects(promise, /synthetic transfer failure/);
  assert.equal(files.has(outputReceipt), false);
  assert.equal(events.includes(`write:${temporaryMarker}`), false);
  assert.equal(events.includes("publish-marker"), false);
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
  assert.match(source, /createDedicatedUiEnvironment/);
  assert.match(source, /\.output/);
  assert.match(source, /server\/index\.mjs/);
  assert.match(source, /Source identity changed while building/);
  assert.match(source, /flag: "wx"/);
  assert.doesNotMatch(source, /shell:\s*true|https:\/\//);
});
