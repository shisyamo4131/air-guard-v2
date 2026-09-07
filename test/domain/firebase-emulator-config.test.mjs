import assert from "node:assert/strict";
import test from "node:test";

import { resolveFirebaseEmulatorConfig } from "../../utils/firebaseEmulatorConfig.js";

const dedicatedConfig = {
  firebaseProjectId: "demo-air-guard-v2-codex",
  firebaseUseEmulator: "true",
  firebaseEmulatorHost: "127.0.0.1",
  firebaseAuthEmulatorPort: "19099",
  firebaseFirestoreEmulatorPort: "18080",
  firebaseDatabaseEmulatorPort: "19000",
  firebaseStorageEmulatorPort: "19199",
  firebaseFunctionsEmulatorPort: "15001",
};

test("dedicated UI config resolves only the approved loopback endpoints", () => {
  assert.deepEqual(resolveFirebaseEmulatorConfig(dedicatedConfig), {
    useEmulator: true,
    host: "127.0.0.1",
    ports: {
      auth: 19099,
      firestore: 18080,
      database: 19000,
      storage: 19199,
      functions: 15001,
    },
  });
});

test("dedicated UI config fails closed when emulators are disabled", () => {
  assert.throws(
    () =>
      resolveFirebaseEmulatorConfig({
        ...dedicatedConfig,
        firebaseUseEmulator: "false",
      }),
    /must use Firebase Emulators/,
  );
});

test("dedicated UI config rejects non-loopback and wrong ports", () => {
  for (const override of [
    { firebaseEmulatorHost: "localhost" },
    { firebaseAuthEmulatorPort: "9099" },
    { firebaseFunctionsEmulatorPort: "5001" },
  ]) {
    assert.throws(
      () => resolveFirebaseEmulatorConfig({ ...dedicatedConfig, ...override }),
      /must use the dedicated loopback emulator endpoints/,
    );
  }
});

test("non-dedicated environments retain the existing emulator defaults", () => {
  assert.deepEqual(
    resolveFirebaseEmulatorConfig(
      { firebaseProjectId: "air-guard-v2-dev", firebaseUseEmulator: true },
      "192.0.2.10",
    ),
    {
      useEmulator: true,
      host: "192.0.2.10",
      ports: {
        auth: 9099,
        firestore: 8080,
        database: 9000,
        storage: 9199,
        functions: 5001,
      },
    },
  );
});

test("non-dedicated environments parse disabled emulator flags strictly", () => {
  for (const firebaseUseEmulator of [undefined, "", false, "false"]) {
    assert.equal(
      resolveFirebaseEmulatorConfig({
        firebaseProjectId: "air-guard-v2-dev",
        firebaseUseEmulator,
      }).useEmulator,
      false,
    );
  }
});

test("non-dedicated environments parse enabled emulator flags strictly", () => {
  for (const firebaseUseEmulator of [true, "true"]) {
    assert.equal(
      resolveFirebaseEmulatorConfig({
        firebaseProjectId: "air-guard-v2-dev",
        firebaseUseEmulator,
      }).useEmulator,
      true,
    );
  }
});

test("invalid emulator flags fail closed", () => {
  for (const firebaseUseEmulator of [null, 0, 1, "FALSE", "unexpected"]) {
    assert.throws(
      () =>
        resolveFirebaseEmulatorConfig({
          firebaseProjectId: "air-guard-v2-dev",
          firebaseUseEmulator,
        }),
      /must be a boolean or the string "true" or "false"/,
    );
  }
});

test("invalid configured ports fail closed", () => {
  assert.throws(
    () =>
      resolveFirebaseEmulatorConfig({
        firebaseProjectId: "air-guard-v2-dev",
        firebaseUseEmulator: true,
        firebaseAuthEmulatorPort: "not-a-port",
      }),
    /valid TCP port/,
  );
});
