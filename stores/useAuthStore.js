import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
} from "firebase/auth";

/**
 * Provides Authentication capabilities and user information who is signed in.
 * - Running `signIn` will attempt to sign in with Firebase Authentication.
 * - Running `signOut` will attempt to sign out with Firebase Authentication.
 *
 * 認証機能と、サインインしているユーザー情報を提供します。
 * - `signIn` を実行すると Firebase Authentication でのサインインを試みます。
 * - `signOut` を実行すると Firebase Authentication でのサインアウトを試みます。
 */
export const useAuthStore = defineStore("auth", () => {
  const logger = useLogger();
  const errors = useErrorsStore();

  /** Define properties */
  const uid = ref(null);
  const email = ref(null);
  const displayName = ref(null);
  const isEmailVerified = ref(false);
  const roles = ref([]);

  /**
   * Store user information.
   * @param {Record} user - User object provided by `onAuthStateChanged`.
   */
  async function setUser(user) {
    const idTokenResult = await user.getIdTokenResult();
    uid.value = user.uid;
    email.value = user.email;
    displayName.value = user?.displayName || "";
    isEmailVerified.value = user?.isEmailVerified || false;
    roles.value = idTokenResult?.claims?.roles || [];
  }

  /**
   * Clear user information.
   */
  function clearUser() {
    uid.value = null;
    email.value = null;
    displayName.value = null;
    isEmailVerified.value = false;
    roles.value = [];
  }

  /**
   * Sign in to Firebase Authentication.
   * @param {Record} payload - { email, password }
   */
  async function signIn(payload) {
    try {
      errors.clear();
      const { $auth } = useNuxtApp();
      await signInWithEmailAndPassword($auth, payload.email, payload.password);
      logger.info({ sender: "useAuth.js", message: "signed in successfully." });
    } catch (error) {
      logger.error({ sender: "useAuth.js", message: error.message, error });
    }
  }

  /**
   * Sign out from Firebase Authentication.
   */
  async function signOut() {
    const { $auth } = useNuxtApp();
    await authSignOut($auth);
  }

  return {
    uid,
    email,
    displayName,
    isEmailVerified,
    roles,
    signIn,
    signOut,
    setUser,
    clearUser,
  };
});
