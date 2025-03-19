import { getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/**
 * Monitor user login status using Firebase Authentication's `onAuthStateChanged`.
 *
 * Firebase Authentication の `onAuthStateChanged` を利用してユーザーのログイン状態を監視します。
 */
export default defineNuxtPlugin(() => {
  // Ensure that Firebase has been initialized.
  // Firebase が初期化済みであることを確認する。
  const app = getApps()?.[0];
  if (!app) {
    const message = `[firebase.auth.js] Firebase is not initialized. Please initialize firebase before use this plugin.`;
    throw new Error(message);
  }

  const auth = useAuthStore();

  // Start monitoring by `onAuthStateChanged`.
  // `onAuthStateChanged` による監視を開始する。
  onAuthStateChanged(getAuth(), async (user) => {
    if (user) {
      console.info(
        `[firebase.auth.js] Auth state is changed. You have signed in.`
      );
      // add process after logged in.
      await auth.setUser(user);
    } else {
      console.info(
        "[firebase.auth.js] Auth state is changed. You have signed out."
      );
      // add process after logged out.
      auth.clearUser();
    }
  });
});
