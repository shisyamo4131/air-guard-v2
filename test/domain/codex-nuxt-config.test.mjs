import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
