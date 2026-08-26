const CODEX_PROJECT_ID = "demo-air-guard-v2-codex";
const CODEX_HOST = "127.0.0.1";
const DEFAULT_PORTS = Object.freeze({
  auth: 9099,
  firestore: 8080,
  database: 9000,
  storage: 9199,
  functions: 5001,
});
const CODEX_PORTS = Object.freeze({
  auth: 19099,
  firestore: 18080,
  database: 19000,
  storage: 19199,
  functions: 15001,
});

function resolvePort(value, fallback, name) {
  const port = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return port;
}

export function resolveFirebaseEmulatorConfig(config, browserHostname = "localhost") {
  const useEmulator = Boolean(config.firebaseUseEmulator);
  const host = config.firebaseEmulatorHost || browserHostname;
  const ports = {
    auth: resolvePort(
      config.firebaseAuthEmulatorPort,
      DEFAULT_PORTS.auth,
      "Firebase Auth Emulator port",
    ),
    firestore: resolvePort(
      config.firebaseFirestoreEmulatorPort,
      DEFAULT_PORTS.firestore,
      "Firestore Emulator port",
    ),
    database: resolvePort(
      config.firebaseDatabaseEmulatorPort,
      DEFAULT_PORTS.database,
      "Realtime Database Emulator port",
    ),
    storage: resolvePort(
      config.firebaseStorageEmulatorPort,
      DEFAULT_PORTS.storage,
      "Storage Emulator port",
    ),
    functions: resolvePort(
      config.firebaseFunctionsEmulatorPort,
      DEFAULT_PORTS.functions,
      "Functions Emulator port",
    ),
  };

  if (config.firebaseProjectId === CODEX_PROJECT_ID) {
    if (config.firebaseUseEmulator !== true && config.firebaseUseEmulator !== "true") {
      throw new Error("The dedicated Codex UI must use Firebase Emulators.");
    }
    if (
      host !== CODEX_HOST ||
      Object.entries(CODEX_PORTS).some(([name, port]) => ports[name] !== port)
    ) {
      throw new Error(
        "The dedicated Codex UI must use the dedicated loopback emulator endpoints.",
      );
    }
  }

  return { useEmulator, host, ports };
}
