import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";

const sender = "useAuthStore.js";

/**
 * 認証機能とサインイン中のユーザー情報を提供するストア。
 * - `signIn`: Firebase Authentication によるサインインを行う
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
  const { add, remove, queue } = useLoadingQueue();
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
    add({ key: "setUser", text: "アカウント情報を確認しています" });
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
      remove("setUser");
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
      add({ key: "signIn", text: "サインインしています..." });
      await signInWithEmailAndPassword($auth, payload.email, payload.password);
      messages.add({ text: "サインインしました", color: "success" });
      logger.info({ sender, message: "Signed in successfully." });
    } catch (error) {
      logger.error({ sender, message: error.message, error });
      throw error;
    } finally {
      remove("signIn");
    }
  }

  async function signOut() {
    const { $auth } = useNuxtApp();
    errors.clear();
    try {
      add({ key: "signOut", text: "サインアウトしています..." });
      await authSignOut($auth);
      messages.add({ text: "サインアウトしました", color: "success" });
      logger.info({ sender, message: "Signed out successfully." });
    } catch (error) {
      logger.error({ sender, message: "Failed to sign out.", error });
      throw error;
    } finally {
      remove("signOut");
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

      add({ key: "signUp", text: "アカウントを作成しています..." });
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
      remove("signUp");
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

  /**
   * Cloud Functions の createUserWithCompany を呼び出し、
   * 管理者ユーザーアカウントを作成します。
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   * @param {string} payload.companyName
   * @param {string} payload.companyNameKana
   * @param {string} payload.displayName
   * @returns {Promise<{ uid: string, companyId: string }>}
   */
  async function createUserWithCompany({
    email,
    password,
    companyName,
    companyNameKana,
    displayName,
  }) {
    const { $functions } = useNuxtApp();
    /** errors ストアを初期化 */
    errors.clear();
    add({
      key: "createUserWithCompany",
      text: "管理者ユーザーアカウントを作成しています",
    });
    try {
      const callable = httpsCallable($functions, "createUserWithCompany");
      const { data } = await callable({
        email,
        password,
        companyName,
        companyNameKana,
        displayName,
      });

      logger.info({
        sender,
        message: `管理者ユーザー「${displayName}」が正常に作成されました（uid: ${data.uid}）。`,
      });

      return {
        uid: data.uid,
        companyId: data.companyId,
      };
    } catch (error) {
      logger.error({
        sender,
        message: error.message || "ユーザー作成中にエラーが発生しました",
        error,
      });
      throw error;
    } finally {
      remove("createUserWithCompany");
    }
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
    createUserWithCompany,
  };
});
