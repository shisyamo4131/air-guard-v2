import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createCodexPostalIsolationPlugin } from "../../scripts/vite-codex-postal-isolation.mjs";

async function loadNuxtConfig(env = {}) {
  const source = await readFile(
    new URL("../../nuxt.config.js", import.meta.url),
    "utf8",
  );
  // Evaluate the real config with synthetic environment values only.
  return runInNewContext(
    source
      .replace(/^import .* from "vite-plugin-vuetify";\r?\n/m, "")
      .replace(/^import .* from "\.\/scripts\/vite-codex-postal-isolation.mjs";\r?\n/m, "")
      .replace("export default defineNuxtConfig(", "defineNuxtConfig("),
    {
      process: { env },
      defineNuxtConfig: (config) => config,
      vuetify: () => ({}),
      transformAssetUrls: {},
      createCodexPostalIsolationPlugin,
    },
  );
}

test("real Nuxt hook registers postal isolation only for dedicated client", async () => {
  for (const dedicated of [false, true]) {
    for (const isClient of [false, true]) {
      const config = await loadNuxtConfig({ NUXT_PUBLIC_FIREBASE_PROJECT_ID: dedicated ? "demo-air-guard-v2-codex" : "synthetic-normal" });
      const hooks = [];
      for (const module of config.modules.filter((value) => typeof value === "function")) {
        module({}, { options: { rootDir: "/synthetic" }, hooks: { hook: (name, fn) => { if (name === "vite:extendConfig") hooks.push(fn); } } });
      }
      assert.ok(hooks.length > 0);
      const vite = { plugins: [] };
      for (const hook of hooks) hook(vite, { isClient });
      assert.equal(vite.plugins.filter((plugin) => plugin.name === "codex-postal-isolation").length, dedicated && isClient ? 1 : 0);
    }
  }
});

function readWorkerFirebaseConfig(source) {
  let captured;
  runInNewContext(source.replace(/^import .* from "firebase\/.*";\r?\n/gm, ""), {
    initializeApp: (config) => {
      captured = JSON.parse(JSON.stringify(config));
      return {};
    },
    getMessaging: () => ({}),
    self: { __WB_MANIFEST: [], addEventListener() {} },
    console: { log() {}, warn() {} },
  });
  return captured;
}

function syntheticFirebaseEnv(label) {
  return {
    NUXT_PUBLIC_FIREBASE_API_KEY: `${label}-api-key`,
    NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${label}.example.invalid`,
    NUXT_PUBLIC_FIREBASE_PROJECT_ID: `${label}-project`,
    NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${label}-bucket`,
    NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: `${label}-sender`,
    NUXT_PUBLIC_FIREBASE_APP_ID: `${label}-app`,
  };
}

function expectedFirebaseConfig(env) {
  return {
    apiKey: env.NUXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.NUXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

for (const label of ["synthetic-dev", "synthetic-prod"]) {
  test(`${label} injects all six Firebase values in independent build and dev paths`, async () => {
    const env = syntheticFirebaseEnv(label);
    const config = await loadNuxtConfig(env);
    const workerSource = await readFile(
      new URL("../../service-worker/sw.js", import.meta.url),
      "utf8",
    );
    const buildPlugin = config.pwa.injectManifest.buildPlugins.vite[0];
    const devPlugin = config.vite.plugins[0];
    assert.notEqual(buildPlugin, devPlugin, "PWA builds must have their own plugin instance");
    assert.ok(config.modules.includes("@vite-pwa/nuxt"));
    assert.equal(config.pwa.devOptions.enabled, true);
    for (const plugin of [buildPlugin, devPlugin]) {
      for (const id of [
        "/synthetic/service-worker/sw.js",
        "C:\\synthetic\\service-worker\\sw.js",
        "service-worker/sw.js?synthetic-query",
      ]) {
        const transformed = plugin.transform(workerSource, id);
        assert.deepEqual(readWorkerFirebaseConfig(transformed), expectedFirebaseConfig(env));
        assert.doesNotMatch(transformed, /__FIREBASE_(?:API_KEY|AUTH_DOMAIN|PROJECT_ID|STORAGE_BUCKET|MESSAGING_SENDER_ID|APP_ID)__/);
        assert.match(transformed, /self\.__WB_MANIFEST/);
      }
    }
  });
}

test("SW injection preserves quotes, escapes, replacement tokens, and placeholder-like values", async () => {
  const env = syntheticFirebaseEnv("synthetic-escaping");
  env.NUXT_PUBLIC_FIREBASE_API_KEY = 'quote" slash\\ newline\n carriage\r tab\t';
  env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "$& $` $' ${synthetic}";
  env.NUXT_PUBLIC_FIREBASE_PROJECT_ID = '"__FIREBASE_APP_ID__"';
  const config = await loadNuxtConfig(env);
  const workerSource = await readFile(new URL("../../service-worker/sw.js", import.meta.url), "utf8");
  for (const plugin of [config.pwa.injectManifest.buildPlugins.vite[0], config.vite.plugins[0]]) {
    assert.deepEqual(
      readWorkerFirebaseConfig(plugin.transform(workerSource, "/synthetic/service-worker/sw.js")),
      expectedFirebaseConfig(env),
    );
  }
});

test("SW injection keeps the existing empty-value fallback and ignores other source files", async () => {
  const config = await loadNuxtConfig();
  const workerSource = await readFile(new URL("../../service-worker/sw.js", import.meta.url), "utf8");
  for (const plugin of [config.pwa.injectManifest.buildPlugins.vite[0], config.vite.plugins[0]]) {
    assert.deepEqual(
      readWorkerFirebaseConfig(plugin.transform(workerSource, "/synthetic/service-worker/sw.js")),
      expectedFirebaseConfig({}),
    );
    for (const id of ["/synthetic/client.js", "/synthetic/service-worker/sw.js.map", "/synthetic/not-service-worker/sw.js"]) {
      assert.equal(plugin.transform(workerSource, id), workerSource);
    }
  }
});

test("evaluated dedicated UI configuration excludes the PWA module", async () => {
  const config = await loadNuxtConfig({ NUXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-air-guard-v2-codex" });
  assert.equal(config.modules.includes("@vite-pwa/nuxt"), false);
});

test("Nuxt exposes configurable Firebase Emulator endpoints", async () => {
  const source = await readFile(
    new URL("../../nuxt.config.js", import.meta.url),
    "utf8",
  );
  for (const environmentName of [
    "NUXT_PUBLIC_FIREBASE_EMULATOR_HOST",
    "NUXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT",
    "NUXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT",
    "NUXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_PORT",
    "NUXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT",
    "NUXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT",
  ]) {
    assert.match(source, new RegExp(`process\\.env\\.${environmentName}`));
  }
});

test("Firebase plugin resolves and uses configured emulator endpoints", async () => {
  const source = await readFile(
    new URL("../../plugins/01.firebase.init.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /resolveFirebaseEmulatorConfig/);
  assert.match(source, /connectAuthEmulator\(auth, `http:\/\/\$\{host\}:\$\{ports\.auth\}`\)/);
  assert.match(source, /connectFirestoreEmulator\(firestore, host, ports\.firestore\)/);
  assert.match(source, /connectStorageEmulator\(storage, host, ports\.storage\)/);
  assert.match(source, /connectDatabaseEmulator\(database, host, ports\.database\)/);
  assert.match(source, /connectFunctionsEmulator\(functions, host, ports\.functions\)/);
});

test("dedicated UI skips Messaging before Service Worker registration", async () => {
  const source = await readFile(
    new URL("../../plugins/08.firebase-messaging.client.js", import.meta.url),
    "utf8",
  );
  const guardIndex = source.indexOf(
    'config.public.firebaseProjectId === "demo-air-guard-v2-codex"',
  );
  const registrationIndex = source.indexOf("navigator.serviceWorker.register");

  assert.ok(guardIndex >= 0, "dedicated project guard must exist");
  assert.ok(registrationIndex >= 0, "Service Worker registration must exist");
  assert.ok(
    guardIndex < registrationIndex,
    "dedicated project guard must run before Service Worker registration",
  );
});

test("dedicated UI disables the PWA module during local build", async () => {
  const source = await readFile(
    new URL("../../nuxt.config.js", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const isCodexDedicatedUi =\s*process\.env\.NUXT_PUBLIC_FIREBASE_PROJECT_ID ===\s*"demo-air-guard-v2-codex"/,
  );
  assert.match(
    source,
    /\.\.\.\(!isCodexDedicatedUi \? \["@vite-pwa\/nuxt"\] : \[\]\)/,
  );
});

test("Dev injectManifest keeps its required Service Worker injection point", async () => {
  const [configSource, serviceWorkerSource] = await Promise.all([
    readFile(new URL("../../nuxt.config.js", import.meta.url), "utf8"),
    readFile(new URL("../../service-worker/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(configSource, /strategies:\s*"injectManifest"/);
  assert.match(configSource, /globPatterns:\s*\[\]/);
  assert.match(
    serviceWorkerSource,
    /const injectedPrecacheManifest = self\.__WB_MANIFEST;/,
  );
  assert.match(
    serviceWorkerSource,
    /if \(injectedPrecacheManifest\.length > 0\)/,
  );
});

test("dedicated UI skips notification permission and FCM token effects", async () => {
  const source = await readFile(
    new URL("../../composables/useNotification.js", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const messagingDisabled =\s*config\.public\.firebaseProjectId ===\s*"demo-air-guard-v2-codex"/,
  );
  assert.match(
    source,
    /async function requestPermission\(\) \{\s*if \(messagingDisabled\)/,
  );
  assert.match(
    source,
    /async function registFCMToken\(userInstance\) \{\s*if \(messagingDisabled\) return;/,
  );
});
