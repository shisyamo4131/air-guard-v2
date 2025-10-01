import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Company } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { doc, onSnapshot } from "firebase/firestore";

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

  /***************************************************************************
   * DEFINE STATES
   ***************************************************************************/
  const isDev = ref(process.env.NODE_ENV === "development"); // Development environment flag
  const isReady = ref(false); // Variable for navigation guards to check if the initial auth state check is complete.

  // User state
  const uid = ref(null);
  const email = ref(null);
  const displayName = ref(null);
  const isEmailVerified = ref(false);
  const _rawRoles = ref([]);
  const companyId = ref(null);
  const isSuperUser = ref(false);

  // Company state fetched by companyId
  const company = ref(new Company());

  // Listener for unsubscribing.
  const listeners = { docCounter: null };

  // Document counter
  const docCounter = ref({});

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  // ユーザー権限 -> isSuperUser である場合は強制的にアドミニストレーター権限を付与
  const roles = computed(() => {
    if (isSuperUser.value) return ["admin"];
    return _rawRoles.value;
  });

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /** Unsubscribe to company data and initialize company instance. */
  function _initCompany() {
    company.value.unsubscribe();
    company.value.initialize();
  }

  function _loadDocCounter() {
    const { $firestore } = useNuxtApp();
    const docPath = `Companies/${companyId.value}/meta/docCounter`;
    const docRef = doc($firestore, docPath);
    listeners.docCounter = onSnapshot(docRef, (docSnap) => {
      docCounter.value = docSnap.exists() ? docSnap.data() : {};
    });
  }

  function _unloadDocCounter() {
    if (listeners.docCounter) listeners.docCounter();
    listeners.docCounter = null;
  }

  /** Clear user state. */
  function _clearUserState() {
    uid.value = null;
    email.value = null;
    displayName.value = null;
    isEmailVerified.value = false;
    _rawRoles.value = [];
    companyId.value = null;
    isSuperUser.value = false;
  }

  /** Set user state. */
  function _setUserState(user, idTokenResult) {
    uid.value = user.uid;
    email.value = user.email;
    displayName.value = user.displayName || "";
    isEmailVerified.value = user.emailVerified || false;
    isSuperUser.value = !!idTokenResult?.claims?.isSuperUser;
    _rawRoles.value = idTokenResult?.claims?.roles || [];
    companyId.value = idTokenResult?.claims?.companyId || null;
  }

  /**
   * Clear User information and unsubscribe to company data.
   * This method is called by AuthStateChanged.
   */
  function clearUser() {
    _clearUserState();
    _initCompany();
    _unloadDocCounter();
  }

  /**
   * Firebase から受け取ったユーザーオブジェクトを基に、ストア内の認証状態を更新します。
   * ユーザーの基本情報と ID トークンからカスタムクレーム（ロール、会社 ID など）を取得し、
   * ストアのリアクティブな状態（uid, email, roles など）にセットします。
   * この関数は通常、Firebase の onAuthStateChanged リスナーから呼び出されます。
   *
   * Updates the authentication state in the store based on the user object received from Firebase.
   * Retrieves basic user information and custom claims (roles, company ID, etc.) from the ID token,
   * and sets them to the store's reactive state (uid, email, roles, etc.).
   * This function is typically called from the Firebase onAuthStateChanged listener.
   *
   * @param {import("firebase/auth").User | null} user - Firebase Authentication から提供されるユーザーオブジェクト、または null (サインアウト時など)。 The user object provided by Firebase Authentication, or null (e.g., on sign-out).
   */
  async function setUser(user) {
    // 認証状態の変更に関わる処理であるため、エラー状態は初期化すべきと判断
    // Clear errors as the authentication state is changing.
    errors.clear();

    // Clear user state.
    _clearUserState();

    // ローディング状態を開始
    // Start loading indicator
    loadings.add({ key: "setUser", text: "アカウント情報を確認しています" }); // Checking account information

    try {
      // ユーザーオブジェクトが存在しない場合（初期読み込み時やサインアウト時など）は処理を中断
      // If the user object does not exist (e.g., on initial load or sign-out), interrupt the process.
      // 注意: この場合、clearUser は onAuthStateChanged の呼び出し元で処理される想定
      // Note: In this case, clearUser is expected to be handled by the caller in onAuthStateChanged
      if (!user) {
        // null ユーザーの場合、状態はクリアされているはずなので、ここでは何もしない
        // If the user is null, the state should already be cleared, so do nothing here.
        return;
      }

      // 必須プロパティ（uid, email）の存在チェック
      // Check for the existence of required properties (uid, email).
      if (!user.uid || !user.email) {
        throw new Error(
          "Invalid User object: Missing required user properties (uid or email)."
        );
      }

      // ID トークンを強制的にリフレッシュして最新のカスタムクレームを取得
      // Force refresh the ID token to get the latest custom claims.
      const idTokenResult = await user.getIdTokenResult(true); // Pass true to force refresh

      // ストアの状態をユーザー情報とクレームで更新
      // Update store state with user information and claims.
      _setUserState(user, idTokenResult);

      // Subscribe company data
      _initCompany();
      if (companyId.value) {
        company.value.subscribe({ docId: companyId.value });
      }

      // Load document counter.
      if (companyId.value) {
        _loadDocCounter();
      }
    } catch (error) {
      // エラー発生時の処理
      // Error handling process.
      logger.error({
        message: `Failed to set user: ${error.message}`,
        error,
      });

      // エラー発生時はストアの状態をクリアして、中途半端な状態を防ぐ
      // Clear the store state on error to prevent an inconsistent state.
      clearUser();

      // エラーを再スローして呼び出し元（onAuthStateChanged など）に失敗を伝える
      // Re-throw the error to notify the caller (e.g., onAuthStateChanged) of the failure.
      throw error;
    } finally {
      // ローディング状態を必ず終了させる
      // Always end the loading state.
      loadings.remove("setUser");
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

      clearUser();

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

      // エラーを再スローして呼び出し元に伝える / Re-throw the error to notify the caller
      throw error;
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
    email,
    displayName,
    isEmailVerified,
    isReady,
    roles,
    companyId,
    isSuperUser,
    company,
    docCounter,
    isDev,
    clearUser,
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
