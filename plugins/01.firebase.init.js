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
 * @author shisyamo4131
 *****************************************************************************/
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

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

  // Flag to determine whether to use emulators
  const useEmulator = config.public.firebaseUseEmulator || false;

  // Firebase initialization
  const apps = getApps();
  const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
  if (useEmulator) {
    apps.length === 0
      ? sendMessage(FIREBASE_INITIALIZED)
      : sendMessage(FIREBASE_ALREADY_INITIALIZED);
  }

  // Obtain various Firebase service instances
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const database = getDatabase(app);
  const functions = getFunctions(app, firebaseRegion);

  // Connect to an emulator if you are in a local environment.
  if (useEmulator) {
    sendMessage(FIREBASE_USE_EMULATORS);

    // --- 実機確認のために修正 ---
    // connectFirestoreEmulator(firestore, "localhost", 8080);
    // connectAuthEmulator(auth, "http://127.0.0.1:9099");
    // connectStorageEmulator(storage, "localhost", 9199);
    // connectDatabaseEmulator(database, "localhost", 9000);
    // connectFunctionsEmulator(functions, "localhost", 5001);

    // PCのIPアドレスを取得（開発時は手動設定も可）
    const hostIP = import.meta.client ? window.location.hostname : "localhost";

    connectFirestoreEmulator(firestore, hostIP, 8080);
    connectAuthEmulator(auth, `http://${hostIP}:9099`);
    connectStorageEmulator(storage, hostIP, 9199);
    connectDatabaseEmulator(database, hostIP, 9000);
    connectFunctionsEmulator(functions, hostIP, 5001);
    // --------------------------
  }

  return {
    provide: { firestore, auth, storage, database, functions },
  };
});
