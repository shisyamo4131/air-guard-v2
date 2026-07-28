/*****************************************************************************
 * Firebase Authentication Observer Plugin for Nuxt3 ver 1.0.0
 * - Monitors user login status using Firebase Authentication's `onAuthStateChanged`.
 * - Automatically reacts to login/logout events and updates the auth store accordingly.
 *
 * Notes:
 * - This plugin requires Firebase to be initialized beforehand.
 *
 * @author shisyamo4131
 *****************************************************************************/
import { getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useAuthActions } from "@/composables/application/auth/useAuthActions";

// Messages for logging or errors
const FIREBASE_NOT_INITIALIZED = `Firebase is not initialized. Please initialize Firebase before using this plugin.`;
const AUTH_STATE_SIGNED_IN = "Auth state changed: user signed in.";
const AUTH_STATE_SIGNED_OUT = "Auth state changed: user signed out.";

export default defineNuxtPlugin(() => {
  const app = getApps()?.[0];
  if (!app) {
    throw new Error(`[firebase.auth.js] ${FIREBASE_NOT_INITIALIZED}`);
  }

  let auth;
  let system;
  let setUser;
  let sessionUpdate = Promise.resolve(); // 認証状態が変化したことによる手続きを直列化するための Promise チェーン

  onAuthStateChanged(getAuth(), (user) => {
    auth ??= useAuthStore();
    system ??= useSystemStore();
    if (!setUser) {
      ({ setUser } = useAuthActions());
    }

    if (system.isDev) {
      const message = user ? AUTH_STATE_SIGNED_IN : AUTH_STATE_SIGNED_OUT;
      console.info(`[firebase.auth.js] ${message}`);
    }

    // 直前の認証状態変更による手続きが完了するまで待機してから、次の手続きを実行する
    sessionUpdate = sessionUpdate
      .then(() => setUser(user))
      .catch((error) => {
        console.error(`[firebase.auth.js] Error updating auth store:`, error);
      });
  });
});
