import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Company, User } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { RoundSetting } from "@/schemas";
import { computed } from "vue";
import FireModel from "@shisyamo4131/air-firebase-v2";

/**
 * Provides authentication functionality and stores information about the signed-in user.
 * - `signIn`: Signs in the user using Firebase Authentication.
 * - `signOut`: Signs out the user.
 * - `setUser`: Stores user data in the store.
 * - `clearUser`: Clears stored user data.
 */
export const useAuthStore = defineStore("auth", () => {
  /***************************************************************************
   * DEFINE STORES AND COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("useAuthStore", useErrorsStore());
  const errors = useErrorsStore();
  const loadings = useLoadingsStore();
  const messages = useMessagesStore();
  const { $vuetify } = useNuxtApp();

  /***************************************************************************
   * DEFINE STATES
   ***************************************************************************/
  const isDev = ref(process.env.NODE_ENV === "development"); // Development environment flag
  const isReady = ref(false); // Variable for navigation guards to check if the initial auth state check is complete.

  // User state
  const uid = ref(null);
  const isEmailVerified = ref(false);
  const isSuperUser = ref(false);
  const companyId = ref(null);

  // Company state fetched by companyId
  const company = ref(new Company());

  const userInstance = reactive(new User());

  // Whether the app is in maintenance mode
  const isMaintenance = ref(false);

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  // ユーザー権限 -> isSuperUser である場合は強制的にアドミニストレーター権限を付与
  const roles = computed(() => {
    const result = userInstance.roles || [];
    if (isSuperUser.value) result.push("super-user");
    if (userInstance.isAdmin) result.push("admin");
    return result;
  });

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  watchEffect(() => {
    // Set allowed minutes for VTimePicker based on company settings
    $vuetify.defaults.value.VTimePicker.allowedMinutes = (val) => {
      if (!company.value?.minuteInterval) return true;
      return val % company.value.minuteInterval === 0;
    };

    // Update `RoundSetting` global setting based on company settings
    RoundSetting.set(company.value?.roundSetting || RoundSetting.ROUND);
  });

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  async function setUser(user) {
    errors.clear();
    try {
      // Force refresh the ID token to get the latest custom claims.
      const idTokenResult = user ? await user.getIdTokenResult(true) : null;

      // Update store state with user information and claims.
      uid.value = user?.uid || null;
      isEmailVerified.value = user?.emailVerified || false;
      isSuperUser.value = !!idTokenResult?.claims?.isSuperUser || false;
      companyId.value = idTokenResult?.claims?.companyId || null;

      // uid と companyId が存在する場合に、FireModel の設定とドキュメントの取得を行う。
      // subscribe だけだと、初回取得時にデータの取得をまたず isReady が true になってしまうため
      // ナビゲーションガードが roles を正しく判断できない。
      // 一旦 fetch でデータを取得してから subscribe を行う。
      if (user && uid.value && companyId.value) {
        FireModel.setConfig({ prefix: `Companies/${companyId.value}` });
        await userInstance.fetch({ docId: uid.value });
        await company.value.fetch({ docId: companyId.value });
        userInstance.subscribe({ docId: uid.value });
        company.value.subscribe({ docId: companyId.value });
      } else {
        userInstance.unsubscribe();
        userInstance.initialize();
        company.value.unsubscribe();
        company.value.initialize();
        FireModel.setConfig({ prefix: `Companies/unknown` });
      }
    } catch (error) {
      // Error handling process.
      logger.error({
        message: `Failed to set user: ${error.message}`,
        error,
      });
    } finally {
      isReady.value = true;
    }
  }

  /**
   * Creates a new user account using email and password.
   * - If `displayName` is provided, it updates the user's profile with the display name.
   * @param {object} args - Sign-up information.
   * @param {string} args.email - User's email address.
   * @param {string} args.password - User's password.
   * @param {string} [args.displayName] - User's display name (optional).
   * @returns {Promise<import("firebase/auth").UserCredential>} - A Promise containing the Firebase UserCredential object.
   * @throws {Error} - Throws an error if validation fails or account creation fails.
   * @throws {TypeError} - Throws a TypeError if email or password are not strings.
   * @throws {FirebaseError} - Throws FirebaseError for errors from Firebase services.
   */
  async function signUp(args = {}) {
    const { email, password, displayName } = args;
    const { $auth } = useNuxtApp();
    if (!email || !password) {
      throw new Error("Email and password are required."); // English message
    }
    if (typeof email !== "string" || typeof password !== "string") {
      throw new TypeError("Email and password must be strings."); // English message
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email format."); // English message
    }

    isReady.value = false;

    const userCredential = await createUserWithEmailAndPassword(
      $auth,
      email,
      password
    );
    await sendEmailVerification(userCredential.user);
    if (displayName) await updateProfile(userCredential.user, { displayName });
    return userCredential;
  }

  /**
   * Signs in using email and password.
   * @param {object} credentials - Sign-in credentials.
   * @param {string} credentials.email - User's email address.
   * @param {string} credentials.password - User's password.
   */
  async function signIn(credentials = {}) {
    const { email, password } = credentials;
    const { $auth } = useNuxtApp();
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }
    if (typeof email !== "string" || typeof password !== "string") {
      throw new TypeError("Email and password must be strings.");
    }

    isReady.value = false;

    await signInWithEmailAndPassword($auth, email, password);
  }

  /**
   * Firebase Authentication を使用してユーザーをサインアウトさせます。
   * 成功時にはストアの状態が onAuthStateChanged リスナー経由でクリアされます。
   *
   * Signs the user out using Firebase Authentication.
   * On success, the store state is cleared via the onAuthStateChanged listener.
   */
  async function signOut() {
    // Nuxt アプリケーションインスタンスから $auth を取得 / Get $auth from the Nuxt application instance
    const { $auth } = useNuxtApp();
    try {
      // サインアウト試行の開始時にエラーをクリア / Clear errors at the start of the sign-out attempt
      errors.clear();

      // ローディング状態を開始 / Start loading state
      loadings.add({ key: "signOut", text: "サインアウトしています..." }); // Signing out...

      // 認証状態変更処理を行う為 isReady を false に更新しておく
      isReady.value = false;

      // clearUser();

      // Firebase Authentication でサインアウトを実行 / Execute sign-out with Firebase Authentication
      await authSignOut($auth);

      // 成功メッセージを追加 / Add success message
      messages.add({ text: "サインアウトしました", color: "success" }); // Signed out successfully

      // 成功ログを記録 / Log success
      // logger.info({ message: "Signed out successfully." });
    } catch (error) {
      // エラーログを記録 / Log the error
      logger.error({
        message: `Sign-out failed: ${error.message}`,
        error,
      });
    } finally {
      // ローディング状態を必ず終了させる / Always end the loading state
      loadings.remove("signOut");
    }
  }

  /**
   * ミドルウェア（ナビゲーションガード）で使用される関数。
   * Firebase の初期認証状態チェックが完了し、ストアの isReady フラグが true になるまで待機します。
   * これにより、認証状態が不確定なままナビゲーションガードが実行されるのを防ぎます。
   *
   * Function used in middleware (navigation guards).
   * Waits until the initial Firebase authentication state check is complete and the store's isReady flag becomes true.
   * This prevents navigation guards from running while the authentication state is uncertain.
   *
   * @param {number} [timeoutMs=5000] - タイムアウトまでのミリ秒数。 / Timeout duration in milliseconds.
   * @returns {Promise<void>} - isReady が true になると解決されるか、タイムアウト時に reject される Promise。 / A Promise that resolves when isReady becomes true or rejects on timeout.
   * @throws {Error} - 指定時間内に isReady が true にならなかった場合にタイムアウトエラーをスローします。 / Throws a timeout error if isReady does not become true within the specified time.
   */
  async function waitUntilReady(timeoutMs = 5000) {
    // すでに準備完了なら即座にリターン / Return immediately if already ready
    if (isReady.value) {
      return;
    }

    let watcherStop = null;
    let timeoutId = null;

    try {
      // isReady が true になるか、タイムアウトするまで待機する Promise / Promise that waits until isReady becomes true or times out
      await new Promise((resolve, reject) => {
        // isReady の変更を監視 / Watch for changes in isReady
        watcherStop = watch(
          () => isReady.value,
          (ready) => {
            if (ready) {
              resolve(); // 準備完了なら Promise を解決 / Resolve the promise if ready
            }
          }
        );

        // タイムアウト処理を設定 / Set up the timeout
        timeoutId = setTimeout(() => {
          const message = `waitUntilReady timed out after ${timeoutMs}ms.`;
          logger.warn({ message }); // タイムアウトを警告ログに記録 / Log timeout as a warning
          reject(new Error(message)); // タイムアウトしたら Promise を reject / Reject the promise on timeout
        }, timeoutMs);
      });
    } catch (error) {
      // タイムアウトエラーをログに記録済みなので、ここでは再スローする
      // The timeout error is already logged, so re-throw it here
      throw error;
    } finally {
      // 必ずウォッチャーとタイマーをクリーンアップ / Always clean up the watcher and timer
      if (watcherStop) {
        watcherStop();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * 指定されたロールを保持しているかどうかを判定します。
   * Checks whether the user has the specified role.
   *
   * @param {string} role - チェック対象のロール名
   * @returns {boolean} - 指定ロールを含む場合は true
   */
  function hasRole(role) {
    return roles.value.includes(role);
  }

  /**
   * Cloud Functions の createUserInCompany を呼び出し、管理者ユーザーアカウントを作成します。
   *
   * @param {object} params - アカウント作成に必要な情報。 / Information required for account creation.
   * @param {string} params.email - 管理者のメールアドレス。 / Administrator's email address.
   * @param {string} params.password - 管理者のパスワード。 / Administrator's password.
   * @param {string} params.displayName - 管理者の表示名。 / Administrator's display name.
   * @returns {Promise<{ uid: string, companyId: string }>} - 作成されたユーザーの UID と会社 ID を含む Promise。 / A Promise containing the created user's UID and company ID.
   * @throws {Error} - バリデーションエラーまたは Cloud Functions 呼び出しエラーが発生した場合。 / Throws an error if validation fails or the Cloud Function call fails.
   */
  async function createUserInCompany({ email, password, displayName }) {
    // Nuxt アプリケーションインスタンスから $functions を取得 / Get $functions from the Nuxt application instance
    const { $functions } = useNuxtApp();

    // ローディング状態を開始 / Start loading state
    loadings.add({
      key: "createUserInCompany",
      text: "ユーザーアカウントを作成しています", // Creating administrator user account...
    });

    try {
      // errors.clear() は呼び出し元コンポーネントで行う想定 / errors.clear() is expected to be called by the calling component

      // --- クライアントサイドバリデーション (例) / Client-side validation (Example) ---
      if (!email || !password || !displayName) {
        throw new Error("All fields are required.");
      }
      if (
        typeof email !== "string" ||
        typeof password !== "string" /* ... 他のフィールドも */
      ) {
        throw new TypeError("Input fields must be strings.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Invalid email format.");
      }
      // 必要に応じてパスワード強度や他のフィールドのバリデーションを追加 / Add password strength or other field validations if needed
      // --- バリデーション終了 / End of validation ---

      // Cloud Functions を呼び出し / Call the Cloud Function
      const callable = httpsCallable($functions, "createUserInCompany");
      const { data } = await callable({
        email,
        password,
        displayName,
        companyId: companyId.value,
      });

      // data オブジェクトに必要なプロパティが含まれているか確認 (任意だが推奨)
      // Check if the data object contains the required properties (optional but recommended)
      if (!data?.uid) {
        throw new Error(
          "Cloud function response is missing expected data (uid)."
        );
      }

      // 成功ログを記録 / Log success
      // logger.info({
      //   message: `ユーザーアカウント「${displayName}」が正常に作成されました（uid: ${data.uid}）。`, // Administrator user "${displayName}" created successfully (uid: ${data.uid}).
      // });

      // 成功メッセージを追加 / Add success message
      messages.add({
        text: "ユーザーアカウントを作成しました",
        color: "success",
      }); // Administrator account created successfully.

      // 結果を返す / Return the result
      return { uid: data.uid };
    } catch (error) {
      // エラーログを記録 / Log the error
      logger.error({
        // Cloud Functions からのエラーメッセージがあればそれを使用、なければフォールバック / Use error message from Cloud Functions if available, otherwise fallback
        message: `Failed to create user in company: ${
          error.message || "An unknown error occurred during user creation."
        }`,
        error,
      });

      // エラーを再スローして呼び出し元に伝える / Re-throw the error to notify the caller
      throw error;
    } finally {
      // ローディング状態を必ず終了させる / Always end the loading state
      loadings.remove("createUserInCompany");
    }
  }

  async function disableUser({ uid }) {
    const { $functions } = useNuxtApp();

    loadings.add({
      key: "disableUser",
      text: "ユーザーアカウントを無効化しています",
    });

    try {
      if (!uid) {
        throw new Error("UID is required.");
      }

      const callable = httpsCallable($functions, "disableUser");
      const { data } = await callable({ uid });

      if (!data?.success) {
        throw new Error("Cloud function response indicates failure.");
      }

      messages.add({
        text: "ユーザーアカウントを無効化しました",
        color: "success",
      });

      return { success: true };
    } catch (error) {
      logger.error({
        message: `Failed to disable user ${uid}: ${
          error.message || "An unknown error occurred."
        }`,
        error,
      });
      throw error;
    } finally {
      loadings.remove("disableUser");
    }
  }

  async function enableUser({ uid }) {
    const { $functions } = useNuxtApp();

    loadings.add({
      key: "enableUser",
      text: "ユーザーアカウントを有効化しています",
    });

    try {
      if (!uid) {
        throw new Error("UID is required.");
      }

      const callable = httpsCallable($functions, "enableUser");
      const { data } = await callable({ uid });

      if (!data?.success) {
        throw new Error("Cloud function response indicates failure.");
      }

      messages.add({
        text: "ユーザーアカウントを有効化しました",
        color: "success",
      });

      return { success: true };
    } catch (error) {
      logger.error({
        message: `Failed to enable user ${uid}: ${
          error.message || "An unknown error occurred."
        }`,
        error,
      });
      throw error;
    } finally {
      loadings.remove("enableUser");
    }
  }

  return {
    uid,
    email: computed(() => userInstance.email),
    displayName: computed(() => userInstance.displayName),
    isEmailVerified,
    isAdmin: computed(() => userInstance.isAdmin),
    isReady,
    roles,
    companyId,
    isSuperUser,
    company,
    isMaintenance,
    isDev,
    signIn,
    signOut,
    signUp,
    setUser,
    waitUntilReady,
    hasRole,
    createUserInCompany,
    disableUser,
    enableUser,
  };
});
