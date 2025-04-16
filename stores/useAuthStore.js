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
  const { startLoading, stopLoading } = useGlobalLoading();
  const messages = useMessagesStore();

  const isReady = ref(false);

  // User state
  const uid = ref(null);
  const email = ref(null);
  const displayName = ref(null);
  const isEmailVerified = ref(false);
  const roles = ref([]);

  function clearUser() {
    uid.value = null;
    email.value = null;
    displayName.value = null;
    isEmailVerified.value = false;
    roles.value = [];

    logger.info({ sender, message: "User information is cleared." });
  }

  async function setUser(user) {
    errors.clear();
    startLoading("setUser", "アカウント情報を確認しています");
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
    } finally {
      stopLoading("setUser");
    }
  }

  async function signIn(payload) {
    const { $auth } = useNuxtApp();
    errors.clear();
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
      startLoading("signIn", "サインインしています...");
      await signInWithEmailAndPassword($auth, payload.email, payload.password);
      messages.add({ text: "ログインしました", color: "success" });
      logger.info({ sender, message: "Signed in successfully." });
    } catch (error) {
      logger.error({ sender, message: error.message, error });
      throw error;
    } finally {
      stopLoading("signIn");
    }
  }

  async function signOut() {
    const { $auth } = useNuxtApp();
    errors.clear();
    try {
      startLoading("signOut", "サインアウトしています...");
      await authSignOut($auth);
      messages.add({ text: "ログアウトしました", color: "success" });
      logger.info({ sender, message: "Signed out successfully." });
    } catch (error) {
      logger.error({ sender, message: "Failed to sign out.", error });
      throw error;
    } finally {
      stopLoading("signOut");
    }
  }

  async function signUp(email, password) {
    const { $auth } = useNuxtApp();
    errors.clear();
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

      startLoading("signUp", "アカウントを作成しています...");
      const result = await createUserWithEmailAndPassword(
        $auth,
        email,
        password
      );
      messages.add({ text: "アカウントを作成しました", color: "success" });
      return result;
    } catch (error) {
      logger.error({ sender, message: error.message, error });
      throw error;
    } finally {
      stopLoading("signUp");
    }
  }

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

  /**
   * 指定されたロールを保持しているかどうかを判定します。
   *
   * Checks whether the user has the specified role.
   *
   * @param {string} role - チェック対象のロール名
   * @returns {boolean} - 指定ロールを含む場合は true
   */
  function hasRole(role) {
    return roles.value.includes(role);
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
    hasRole,
  };
});
