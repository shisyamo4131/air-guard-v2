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

  // Start monitoring by `onAuthStateChanged`.
  // `onAuthStateChanged` による監視を開始する。
  onAuthStateChanged(getAuth(), async (user) => {
    if (user) {
      console.info(
        `[firebase.auth.js] Auth state is changed. You have signed in.`
      );
      // add process after logged in.
      await afterSignedIn(user);
    } else {
      console.info(
        "[firebase.auth.js] Auth state is changed. You have signed out."
      );
      // add process after logged out.
      afterSignedOut();
    }
  });
});

/**
 * Processes executed after sign-in.
 * - Stores information about signed-in users in `pinia.useAuthStore`.
 *
 * サインインした後に実行される処理です。
 * - サインインしたユーザーの情報を `pinia.useAuthStore` に保存します。
 * @param {Record} user - Object returned by the `onAuthChanged` observer.
 *                      - `onAuthChanged` オブザーバーによって返されるオブジェクト。
 */
async function afterSignedIn(user) {
  const auth = useAuthStore();
  await auth.setUser(user);
}

/**
 * Processes executed after sign-out.
 * - Initialize user information stored in `pinia.useAuthStore`.
 *
 * サインアウトした後に実行される処理です。
 * - `pinia.useAuthStore` に保存されているユーザー情報を初期化します。
 */
function afterSignedOut() {
  const auth = useAuthStore();
  auth.clearUser();
}
