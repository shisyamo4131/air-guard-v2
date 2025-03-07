import { initializeFirebase } from "air-firebase-v2";
import { defineNuxtPlugin } from "#app";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const useEmulator = config.public.firebaseUseEmulator || false;

  initializeFirebase(
    {
      apiKey: config.public.firebaseApiKey,
      authDomain: config.public.firebaseAuthDomain,
      projectId: config.public.firebaseProjectId,
      storageBucket: config.public.firebaseStorageBucket,
      messagingSenderId: config.public.firebaseMessagingSenderId,
      appId: config.public.firebaseAppId,
      databaseURL: config.public.firebaseDatabaseURL || "",
    },
    useEmulator
  );
});
