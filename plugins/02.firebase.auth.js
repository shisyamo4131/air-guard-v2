/*****************************************************************************
 * Firebase Authentication Observer Plugin for Nuxt3 ver 1.0.0
 * - Monitors user login status using Firebase Authentication's `onAuthStateChanged`.
 * - Automatically reacts to login/logout events and updates the auth store accordingly.
 *
 * How to use:
 * - Define your own `setUser` and `clearUser` functions to handle user state changes.
 * - Import and register this plugin in your Nuxt3 application.
 *
 * Notes:
 * - This plugin requires Firebase to be initialized beforehand.
 *
 * @author shisyamo4131
 *****************************************************************************/
// import FireModel from "@shisyamo4131/air-firebase-v2";
import { getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/**
 * ***** EDIT THIS FUNCTION FOR YOUR PROJECT *****
 * A function called when the authentication state changes to signed in.
 * @param {firebase.UserCredential} userCredential
 */
const setUser = async (userCredential) => {
  // const idToken = await userCredential.getIdTokenResult(true);
  // const companyId = idToken?.claims?.companyId;
  // FireModel.setConfig({ prefix: `Companies/${companyId || "unknown"}` });
  const auth = useAuthStore();
  await auth.setUser(userCredential);
};

/**
 * ***** EDIT THIS FUNCTION FOR YOUR PROJECT *****
 * A function called when the authentication state changes to signed out.
 */
const clearUser = () => {
  // FireModel.setConfig({ prefix: `Companies/unknown` });
  const auth = useAuthStore();
  // auth.clearUser();
  auth.setUser();
};

// Messages for logging or errors
const FIREBASE_NOT_INITIALIZED = `Firebase is not initialized. Please initialize Firebase before using this plugin.`;
const AUTH_STATE_SIGNED_IN = "Auth state changed: user signed in.";
const AUTH_STATE_SIGNED_OUT = "Auth state changed: user signed out.";

export default defineNuxtPlugin(() => {
  const app = getApps()?.[0];
  if (!app) {
    throw new Error(`[firebase.auth.js] ${FIREBASE_NOT_INITIALIZED}`);
  }

  onAuthStateChanged(getAuth(), async (user) => {
    if (user) {
      console.info(`[firebase.auth.js] ${AUTH_STATE_SIGNED_IN}`);
      await setUser(user);
    } else {
      console.info(`[firebase.auth.js] ${AUTH_STATE_SIGNED_OUT}`);
      clearUser();
    }
  });
});
