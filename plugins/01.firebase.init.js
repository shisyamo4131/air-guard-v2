/*****************************************************************************
 * # Firebase Initialization Plugin for Nuxt3 ver 1.0.0
 *
 * Nuxt3 plugin to initialize Firebase and provide various service instances.
 * - Reads environment variables from `runtimeConfig(public)` in `nuxt.config.js`.
 * - For using emulator, set `firebaseUseEmulator` to true in runtimeConfig.
 * - Region for Cloud Functions can be set via `firebaseRegion` in runtimeConfig.
 *   Default is 'us-central1'.
 *
 * ## How to use:
 * In your component, you can access the services via `$firestore`, `$auth`, etc.
 * from useNuxtApp(). For example:
 *
 * ```javascript
 * import { useNuxtApp } from '#app';
 * const { $firestore, $auth } = useNuxtApp();
 * ```
 *
 * [不具合対応]
 * 2026-06-17 - DOM 遅延更新への対応として experimentalForceLongPolling を設定してみる。
 *              WiFi: 現象再現せず
 *              5G オート: 現象再現せず
 *              5G オン: 現象再現せず
 *              4G: 現象再現せず
 *              結果、DOM 遅延更新の原因は通信環境が不安定な状況でストリーム方式による
 *              Firestore との接続と考えられる。今後も引き続き様子見。
 *
 * @author shisyamo4131
 *****************************************************************************/
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

/** 2026-06-17 - DOM 遅延更新対策 */
// import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  connectFirestoreEmulator,
  initializeFirestore,
} from "firebase/firestore";

import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { resolveFirebaseEmulatorConfig } from "../utils/firebaseEmulatorConfig.js";

// Messages for logging
const FIREBASE_INITIALIZED = "Firebase has been successfully initialized.";
const FIREBASE_ALREADY_INITIALIZED = "Firebase is already initialized.";
const FIREBASE_USE_EMULATORS = "Using Firebase Emulators.";

// Utility function for logging messages
const sendMessage = (message) => {
  console.info(`[firebase.init.js] ${message}`);
};

export default defineNuxtPlugin(() => {
  // Get Firebase configuration from `runtimeConfig`.
  const config = useRuntimeConfig();
  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId,
    databaseURL: config.public.firebaseDatabaseURL || "",
  };

  // Default region for Cloud Functions
  const firebaseRegion = config.public.firebaseRegion || "us-central1";

  const browserHostname = import.meta.client
    ? window.location.hostname
    : "localhost";
  const emulatorConfig = resolveFirebaseEmulatorConfig(
    config.public,
    browserHostname,
  );
  const { useEmulator } = emulatorConfig;

  // Firebase initialization
  const apps = getApps();
  const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
  if (useEmulator) {
    apps.length === 0
      ? sendMessage(FIREBASE_INITIALIZED)
      : sendMessage(FIREBASE_ALREADY_INITIALIZED);
  }

  // Obtain various Firebase service instances

  /** 2026-06-17 - DOM 遅延更新対策 */
  // const firestore = getFirestore(app);
  const firestore = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });

  const auth = getAuth(app);
  const storage = getStorage(app);
  const database = getDatabase(app);
  const functions = getFunctions(app, firebaseRegion);

  // Connect to an emulator if you are in a local environment.
  if (useEmulator) {
    sendMessage(FIREBASE_USE_EMULATORS);

    const { host, ports } = emulatorConfig;
    connectFirestoreEmulator(firestore, host, ports.firestore);
    connectAuthEmulator(auth, `http://${host}:${ports.auth}`);
    connectStorageEmulator(storage, host, ports.storage);
    connectDatabaseEmulator(database, host, ports.database);
    connectFunctionsEmulator(functions, host, ports.functions);
  }

  return {
    provide: { app, firestore, auth, storage, database, functions },
  };
});
