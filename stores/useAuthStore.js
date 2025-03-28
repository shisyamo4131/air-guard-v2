import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const sender = "useAuthStore.js";

/**
 * 認証機能とサインイン中のユーザー情報を提供するストア。
 * - `signIn`: Firebase Authentication によるログインを行う
 * - `signOut`: サインアウト処理を行う
 * - `setUser`: ユーザー情報をストアに保存する
 * - `clearUser`: 保存されたユーザー情報を初期化する
 *
 * Provides authentication functionality and stores information about the signed-in user.
 * - `signIn`: Signs in the user using Firebase Authentication.
 * - `signOut`: Signs out the user.
 * - `setUser`: Stores user data in the store.
 * - `clearUser`: Clears stored user data.
 */
export const useAuthStore = defineStore("auth", () => {
  const logger = useLogger();
  const errors = useErrorsStore();

  const isReady = ref(false);

  // User state
  const uid = ref(null);
  const email = ref(null);
  const displayName = ref(null);
  const isEmailVerified = ref(false);
  const roles = ref([]);

  /**
   * ユーザー情報をすべて初期化します。
   *
   * Clears all stored user information.
   */
  function clearUser() {
    uid.value = null;
    email.value = null;
    displayName.value = null;
    isEmailVerified.value = false;
    roles.value = [];

    logger.info({ sender, message: "User information is cleared." });
  }

  /**
   * Firebase ユーザー情報を保存し、カスタムクレームからロールを取得します。
   *
   * Stores user information and extracts roles from token claims.
   *
   * @param {User} user - Firebase Auth のユーザーオブジェクト
   * @returns {Promise<void>}
   */
  async function setUser(user) {
    try {
      if (!user?.uid || !user.email) {
        throw new Error(
          "Invalid User object: Missing required user properties."
        );
      }

      const idTokenResult = await user.getIdTokenResult();
      uid.value = user.uid;
      email.value = user.email;
      displayName.value = user.displayName || "";
      isEmailVerified.value = user.emailVerified || false;
      roles.value = idTokenResult?.claims?.roles || [];
    } catch (error) {
      logger.error({ sender, message: error.message, error });
      throw error;
    }
  }

  /**
   * メールアドレスとパスワードでサインインします。
   *
   * Signs in using email and password via Firebase Auth.
   *
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   * @returns {Promise<void>}
   */
  async function signIn(payload) {
    try {
      if (
        !payload?.email ||
        !payload?.password ||
        typeof payload.email !== "string" ||
        typeof payload.password !== "string"
      ) {
        throw new Error("Invalid payload: email and password are required.");
      }

      errors.clear();

      const { $auth } = useNuxtApp();
      await signInWithEmailAndPassword($auth, payload.email, payload.password);

      logger.info({ sender, message: "Signed in successfully." });
    } catch (error) {
      logger.error({ sender, message: error.message, error });
      throw error;
    }
  }

  /**
   * 現在のユーザーを Firebase Auth からサインアウトします。
   *
   * Signs out the current user from Firebase Auth.
   *
   * @returns {Promise<void>}
   */
  async function signOut() {
    try {
      const { $auth } = useNuxtApp();
      await authSignOut($auth);
      logger.info({ sender, message: "Signed out successfully." });
    } catch (error) {
      logger.error({ sender, message: "Failed to sign out.", error });
      throw error;
    }
  }

  /**
   * メールアドレスとパスワードで新規ユーザーを作成します。
   *
   * Registers a new user using Firebase Auth.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<UserCredential>}
   */
  async function signUp(email, password) {
    const { $auth } = useNuxtApp();
    try {
      if (!email || !password) {
        throw new Error("email and password are required.");
      }
      if (typeof email !== "string" || typeof password !== "string") {
        throw new TypeError("email and password must be strings.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Invalid email format.");
      }

      return await createUserWithEmailAndPassword($auth, email, password);
    } catch (error) {
      logger.error({ sender, message: error.message, error });
      throw error;
    }
  }

  /**
   * Firebase の認証状態が確定するまで待機します。
   *
   * Waits until Firebase authentication state is confirmed.
   *
   * @returns {Promise<void>}
   */
  async function waitUntilReady() {
    if (isReady.value) return;

    await new Promise((resolve) => {
      const stop = watch(
        () => isReady.value,
        (ready) => {
          if (ready) {
            stop();
            resolve();
          }
        }
      );
    });
  }

  return {
    uid,
    email,
    displayName,
    isEmailVerified,
    isReady,
    roles,
    clearUser,
    signIn,
    signOut,
    signUp,
    setUser,
    waitUntilReady,
  };
});
