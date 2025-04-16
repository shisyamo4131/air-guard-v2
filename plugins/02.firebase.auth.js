import FireModel from "air-firebase-v2";
import { getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/**
 * Monitor user login status using Firebase Authentication's `onAuthStateChanged`.
 * - Automatically reacts to login/logout events and updates the auth store accordingly.
 *
 * Firebase Authentication の `onAuthStateChanged` を利用してユーザーのサインイン状態を監視します。
 * - サインイン・サインアウトのイベントに応じて、認証ストアを自動的に更新します。
 */
export default defineNuxtPlugin(() => {
  // Ensure that Firebase has been initialized.
  // Firebase が初期化済みであることを確認する。
  const app = getApps()?.[0];
  if (!app) {
    const message = `[firebase.auth.js] Firebase is not initialized. Please initialize Firebase before using this plugin.`;
    throw new Error(message);
  }

  const auth = useAuthStore();

  // Start monitoring by `onAuthStateChanged`.
  // `onAuthStateChanged` による監視を開始する。
  onAuthStateChanged(getAuth(), async (user) => {
    if (user) {
      console.info(`[firebase.auth.js] Auth state changed: user signed in.`);
      // Process after user signs in
      await auth.setUser(user);

      // FireModel のコレクションパスに prefix を追加
      FireModel.setConfig({ prefix: `Companies/${auth.companyId}/` });
    } else {
      console.info(`[firebase.auth.js] Auth state changed: user signed out.`);
      // Process after user signs out
      auth.clearUser();

      // FireModel のコレクションパスの prefix を unknown に変更
      FireModel.setConfig({ prefix: `Companies/unknown/` });
    }

    /** useAuthStore の isReady を true に更新 */
    auth.isReady = true;
  });
});
