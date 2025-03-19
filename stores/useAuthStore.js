import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
  createUserWithEmailAndPassword,
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
   * Creates a new user with an email and password using the authentication provider.
   * - Uses Firebase authentication (`createUserWithEmailAndPassword`) to register a new user.
   *
   * ユーザーを新規に作成します。
   * - Firebase の認証機能 (`createUserWithEmailAndPassword`) を使用して、新しいユーザーを登録します。
   *
   * @param {string} email - The email address of the new user (must be a valid email format).
   *                         新規ユーザーのメールアドレス（有効なメール形式である必要があります）。
   * @param {string} password - The password for the new user (must be a non-empty string).
   *                            新規ユーザーのパスワード（空でない文字列である必要があります）。
   * @returns {Promise<UserCredential>} Resolves with the user credentials upon successful registration.
   *                                    登録が成功すると `UserCredential` を含むプロミスが解決されます。
   * @throws {Error} Throws an error if `email` or `password` is missing.
   *                 `email` または `password` が不足している場合にエラーをスローします。
   * @throws {TypeError} Throws a TypeError if `email` or `password` is not a string.
   *                     `email` または `password` が文字列でない場合に `TypeError` をスローします。
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
      logger.error({
        sender: "useAuthStore.js",
        message: error.message,
        error,
      });
      throw error;
    }
  }

  /**
   * Stores user information from the provided `User` object.
   * - Retrieves and stores user-related properties such as `uid`, `email`, `displayName`, and `isEmailVerified`.
   * - Fetches the user's ID token result and extracts `roles` from the token claims.
   *
   * `User` オブジェクトから情報を取得し、保存します。
   * - `uid`、`email`、`displayName`、`isEmailVerified` などのユーザー関連プロパティを保存します。
   * - ID トークンを取得し、トークンの `claims` から `roles` を抽出します。
   *
   * @param {User} user - Authenticated user object provided by `onAuthStateChanged`.
   *                      `onAuthStateChanged` によって提供される `User` オブジェクト。
   * @returns {Promise<void>} Resolves when the user information is successfully stored.
   *                          ユーザー情報が正常に保存されると解決されるプロミス。
   * @throws {Error} Throws an error if retrieving the ID token fails.
   *                 ID トークンの取得に失敗した場合にエラーをスローします。
   */
  async function setUser(user) {
    try {
      if (!user || !user.uid || !user.email) {
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
      logger.error({
        sender: "useAuthStore.js",
        message: error.message,
        error,
      });
      throw error;
    }
  }

  /**
   * Clears all stored user information.
   * - Resets `uid`, `email`, and `displayName` to `null`.
   * - Sets `isEmailVerified` to `false`.
   * - Clears the `roles` array.
   *
   * ユーザー情報をすべてクリアします。
   * - `uid`、`email`、`displayName` を `null` にリセットします。
   * - `isEmailVerified` を `false` に設定します。
   * - `roles` 配列を空にします。
   *
   * @returns {void} No return value.
   *                 戻り値はありません。
   */
  function clearUser() {
    uid.value = null;
    email.value = null;
    displayName.value = null;
    isEmailVerified.value = false;
    roles.value = [];
    logger.info({
      sender: "useAuthStore.js",
      message: "User information is cleared.",
    });
  }

  /**
   * Signs in a user to Firebase Authentication using an email and password.
   * - Clears existing errors before attempting authentication.
   * - Logs a success message upon successful sign-in.
   * - Logs and throws an error if authentication fails.
   *
   * Firebase Authentication を使用してユーザーをサインインします。
   * - 認証を試みる前に既存のエラーをクリアします。
   * - 認証成功時にログを記録します。
   * - 認証に失敗した場合はエラーログを出力し、エラーをスローします。
   *
   * @param {Object} payload - User credentials for authentication.
   *                           認証のためのユーザー情報。
   * @param {string} payload.email - The user's email address.
   *                                  ユーザーのメールアドレス。
   * @param {string} payload.password - The user's password.
   *                                     ユーザーのパスワード。
   * @returns {Promise<void>} Resolves when the user is successfully signed in.
   *                          ユーザーが正常にサインインすると解決されるプロミス。
   * @throws {Error} Throws an error if authentication fails.
   *                 認証に失敗した場合、エラーをスローします。
   */
  async function signIn(payload) {
    try {
      if (
        !payload ||
        typeof payload.email !== "string" ||
        typeof payload.password !== "string"
      ) {
        throw new Error("Invalid payload: email and password are required.");
      }

      errors.clear();
      const { $auth } = useNuxtApp();
      await signInWithEmailAndPassword($auth, payload.email, payload.password);
      logger.info({
        sender: "useAuthStore.js",
        message: "Signed in successfully.",
      });
    } catch (error) {
      logger.error({
        sender: "useAuthStore.js",
        message: error.message,
        error,
      });
      throw error;
    }
  }

  /**
   * Signs out the currently authenticated user from Firebase Authentication.
   * - Calls `authSignOut($auth)` to log the user out.
   *
   * Firebase Authentication から現在のユーザーをサインアウトします。
   * - `authSignOut($auth)` を呼び出してログアウトを実行します。
   *
   * @returns {Promise<void>} Resolves when the user is successfully signed out.
   *                          ユーザーが正常にサインアウトされると解決されるプロミス。
   * @throws {Error} Throws an error if the sign-out process fails.
   *                 サインアウト処理に失敗した場合、エラーをスローします。
   */
  async function signOut() {
    try {
      const { $auth } = useNuxtApp();
      await authSignOut($auth);
      logger.info({
        sender: "useAuthStore.js",
        message: "Signed out successfully.",
      });
    } catch (error) {
      logger.error({
        sender: "useAuthStore.js",
        message: "Failed to sign out.",
        error,
      });
      throw error;
    }
  }

  return {
    uid,
    email,
    displayName,
    isEmailVerified,
    roles,
    clearUser,
    signIn,
    signOut,
    signUp,
    setUser,
  };
});
