import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

/**
 * Plugin to initialize Firebase
 * - Environment variables are read from `runtimeConfig(public)` in `nuxt.config.js`.
 * - Provides various service instances of Firebase to the application.
 *
 * Firebase を初期化するプラグイン
 * - 環境変数は `nuxt.config.js` の `runtimeConfig(public)` から読み込みます。
 * - Firebase の各種サービスインスタンスをアプリケーションに提供します。
 *
 * { $firestore, $auth, $storage, $database, $functions }
 */
export default defineNuxtPlugin(() => {
  // Read environment variables from `runtimeConfig`.
  // `runtimeConfig` から環境変数を読み込む
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

  const useEmulator = config.public.firebaseUseEmulator || false;

  // Firebase initialization
  // Firebase の初期化
  const apps = getApps();
  let app = null;
  if (apps.length === 0) {
    app = initializeApp(firebaseConfig);
    console.info(
      `[firebase.init.js] Firebase has been successfully initialized.`
    );
  } else {
    console.info(`[firebase.init.js] Firebase is already initialized.`);
    app = apps[0];
  }

  // Obtain various Firebase service instances
  // Firebase の各種サービスインスタンスを取得
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const database = getDatabase(app);
  const functions = getFunctions(
    app,
    config.public.firebaseRegion || "us-central1"
  );

  // Connect to an emulator if you are in a local environment.
  // ローカル環境ならエミュレーターに接続
  if (useEmulator) {
    console.info(
      "[firebase.init.js] Using Firebase Emulators because the environment is local."
    );

    connectFirestoreEmulator(firestore, "localhost", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connectStorageEmulator(storage, "localhost", 9199);
    connectDatabaseEmulator(database, "localhost", 9000);
    connectFunctionsEmulator(functions, "localhost", 5001);
  }

  return {
    provide: {
      firestore,
      auth,
      storage,
      database,
      functions,
    },
  };
});
