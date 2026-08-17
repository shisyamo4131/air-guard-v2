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
