import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Company } from "@/schemas";

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
  const { add, remove } = useLoadingsStore();
  const messages = useMessagesStore();

  const isReady = ref(false);

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

  // ユーザー権限 -> isSuperUser である場合は強制的にアドミニストレーター権限を付与
  const roles = computed(() => {
    if (isSuperUser.value) {
      return ["admin"];
    }
    return _rawRoles.value;
  });

  /** Unsubscribe to company data and initialize company instance. */
  function _initCompany() {
    company.value.unsubscribe();
    company.value.initialize();
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
    // Clear uset state.
    _clearUserState();
    logger.info({ sender, message: "User information is cleared." });

    // Unsubscribe to company data.
    _initCompany();
    logger.info({
      sender,
      message:
        "Unsubscribed from company data and initialized company instance.",
    });
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
    add({ key: "setUser", text: "アカウント情報を確認しています" }); // Checking account information

    try {
      // ユーザーオブジェクトが存在しない場合（初期読み込み時やサインアウト時など）は処理を中断
      // If the user object does not exist (e.g., on initial load or sign-out), interrupt the process.
      // 注意: この場合、clearUser は onAuthStateChanged の呼び出し元で処理される想定
      // Note: In this case, clearUser is expected to be handled by the caller in onAuthStateChanged
      if (!user) {
        logger.info({
          sender,
          message: "setUser called with null user. Skipping state update.",
        });
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

      logger.info({
        sender,
        message: `User state updated for UID: ${user.uid}`,
      });

      // Subscribe company data
      _initCompany();
      if (companyId.value) {
        company.value.subscribe({ docId: companyId.value });
        logger.info({
          sender,
          message: `Subscribing for company data: ${companyId.value}`,
        });
      }
    } catch (error) {
      // エラー発生時の処理
      // Error handling process.
      logger.error({
        sender,
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
      remove("setUser");
    }
  }

  /**
   * メールアドレスとパスワードを使用してサインインを行います。
   * Signs in using email and password.
   *
   * @param {object} credentials - サインイン情報。(Sign-in information.)
   * @param {string} credentials.email - ユーザーのメールアドレス。(User's email address.)
   * @param {string} credentials.password - ユーザーのパスワード。(User's password.)
   */
  async function signIn({ email, password }) {
    // Nuxt アプリケーションインスタンスから $auth を取得
    // Get $auth from the Nuxt application instance
    const { $auth } = useNuxtApp();
    try {
      // バリデーション: email と password が文字列として存在するか確認
      // Validate credentials: check if email and password exist as strings
      if (
        !email ||
        !password ||
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        // 不正な場合はエラーをスロー
        // Throw an error if invalid
        throw new Error("メールアドレスとパスワードは必須入力です。");
        // English: "Invalid credentials: email and password are required and must be strings."
      }

      // ローディング状態を開始
      // Start loading state
      add({ key: "signIn", text: "サインインしています..." }); // Signing in...

      // 認証状態変更処理を行う為 isReady を false に更新しておく
      isReady.value = false;

      // Firebase Authentication でサインインを実行
      // Execute sign-in with Firebase Authentication
      await signInWithEmailAndPassword($auth, email, password);

      // 成功メッセージを追加
      // Add success message
      messages.add({ text: "サインインしました", color: "success" }); // Signed in successfully

      // 成功ログを記録
      // Log success
      logger.info({ sender, message: "Signed in successfully." });
    } catch (error) {
      // エラーログを記録
      // Log the error
      logger.error({
        sender,
        message: `Sign-in failed: ${error.message}`,
        error,
      });

      // エラーを再スローして呼び出し元に伝える
      // Re-throw the error to notify the caller
      throw error;
    } finally {
      // ローディング状態を必ず終了させる
      // Always end the loading state
      remove("signIn");
    }
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
      add({ key: "signOut", text: "サインアウトしています..." }); // Signing out...

      // 認証状態変更処理を行う為 isReady を false に更新しておく
      isReady.value = false;

      // Firebase Authentication でサインアウトを実行 / Execute sign-out with Firebase Authentication
      await authSignOut($auth);

      // 成功メッセージを追加 / Add success message
      messages.add({ text: "サインアウトしました", color: "success" }); // Signed out successfully

      // 成功ログを記録 / Log success
      logger.info({ sender, message: "Signed out successfully." });
    } catch (error) {
      // エラーログを記録 / Log the error
      logger.error({
        sender,
        message: `Sign-out failed: ${error.message}`,
        error,
      });

      // エラーを再スローして呼び出し元に伝える / Re-throw the error to notify the caller
      throw error;
    } finally {
      // ローディング状態を必ず終了させる / Always end the loading state
      remove("signOut");
    }
  }

  /**
   * メールアドレスとパスワードを使用して新しいユーザーアカウントを作成します。
   * Creates a new user account using email and password.
   *
   * @param {string} email - ユーザーのメールアドレス。 / User's email address.
   * @param {string} password - ユーザーのパスワード。 / User's password.
   * @returns {Promise<import("firebase/auth").UserCredential>} - Firebase の UserCredential オブジェクトを含む Promise。 / A Promise containing the Firebase UserCredential object.
   */
  async function signUp(email, password) {
    // Nuxt アプリケーションインスタンスから $auth を取得 / Get $auth from the Nuxt application instance
    const { $auth } = useNuxtApp();
    try {
      // errors.clear() は呼び出し元コンポーネントで行う想定 / errors.clear() is expected to be called by the calling component

      // バリデーション / Validation
      if (!email || !password) {
        throw new Error("Email and password are required."); // English message
      }
      if (typeof email !== "string" || typeof password !== "string") {
        // 型チェックは TypeScript を使っていれば不要になることが多い / Type check might be unnecessary if using TypeScript
        throw new TypeError("Email and password must be strings."); // English message
      }
      // 簡単なメール形式チェック / Simple email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Invalid email format."); // English message
      }
      // パスワード強度チェックを追加することも検討 / Consider adding password strength checks

      // ローディング状態を開始 / Start loading state
      add({ key: "signUp", text: "アカウントを作成しています..." }); // Creating account... (Japanese OK for UI)

      // 認証状態変更処理を行う為 isReady を false に更新しておく
      isReady.value = false;

      // Firebase Authentication でアカウント作成を実行 / Execute account creation with Firebase Authentication
      const result = await createUserWithEmailAndPassword(
        $auth,
        email,
        password
      );

      // 成功メッセージを追加 / Add success message
      messages.add({ text: "アカウントを作成しました", color: "success" }); // Account created successfully (Japanese OK for UI)

      // 成功ログを記録 / Log success
      logger.info({
        sender,
        message: `Account created successfully for ${email}`,
      });

      // Firebase から返された UserCredential を返す / Return the UserCredential from Firebase
      return result;
    } catch (error) {
      // エラーログを記録 / Log the error
      logger.error({
        sender,
        message: `Sign-up failed: ${error.message}`,
        error,
      });

      // エラーを再スローして呼び出し元に伝える / Re-throw the error to notify the caller
      throw error; // Firebaseからのエラーはそのままスローされる
    } finally {
      // ローディング状態を必ず終了させる / Always end the loading state
      remove("signUp");
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
          logger.warn({ sender, message }); // タイムアウトを警告ログに記録 / Log timeout as a warning
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
   * Cloud Functions の createUserWithCompany を呼び出し、管理者ユーザーアカウントを作成します。
   * Calls the Cloud Function 'createUserWithCompany' to create an administrator user account.
   *
   * @param {object} params - アカウント作成に必要な情報。 / Information required for account creation.
   * @param {string} params.email - 管理者のメールアドレス。 / Administrator's email address.
   * @param {string} params.password - 管理者のパスワード。 / Administrator's password.
   * @param {string} params.companyName - 会社名。 / Company name.
   * @param {string} params.companyNameKana - 会社名（カナ）。 / Company name (Kana).
   * @param {string} params.displayName - 管理者の表示名。 / Administrator's display name.
   * @returns {Promise<{ uid: string, companyId: string }>} - 作成されたユーザーの UID と会社 ID を含む Promise。 / A Promise containing the created user's UID and company ID.
   * @throws {Error} - バリデーションエラーまたは Cloud Functions 呼び出しエラーが発生した場合。 / Throws an error if validation fails or the Cloud Function call fails.
   */
  async function createUserWithCompany({
    email,
    password,
    companyName,
    companyNameKana,
    displayName,
  }) {
    // Nuxt アプリケーションインスタンスから $functions を取得 / Get $functions from the Nuxt application instance
    const { $functions } = useNuxtApp();

    // ローディング状態を開始 / Start loading state
    add({
      key: "createUserWithCompany",
      text: "管理者ユーザーアカウントを作成しています", // Creating administrator user account...
    });

    try {
      // errors.clear() は呼び出し元コンポーネントで行う想定 / errors.clear() is expected to be called by the calling component

      // --- クライアントサイドバリデーション (例) / Client-side validation (Example) ---
      if (
        !email ||
        !password ||
        !companyName ||
        !companyNameKana ||
        !displayName
      ) {
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
      const callable = httpsCallable($functions, "createUserWithCompany");
      const { data } = await callable({
        email,
        password,
        companyName,
        companyNameKana,
        displayName,
      });

      // data オブジェクトに必要なプロパティが含まれているか確認 (任意だが推奨)
      // Check if the data object contains the required properties (optional but recommended)
      if (!data?.uid || !data?.companyId) {
        throw new Error(
          "Cloud function response is missing expected data (uid or companyId)."
        );
      }

      // 成功ログを記録 / Log success
      logger.info({
        sender,
        message: `管理者ユーザー「${displayName}」が正常に作成されました（uid: ${data.uid}）。`, // Administrator user "${displayName}" created successfully (uid: ${data.uid}).
      });

      // 成功メッセージを追加 / Add success message
      messages.add({
        text: "管理者アカウントを作成しました",
        color: "success",
      }); // Administrator account created successfully.

      // 結果を返す / Return the result
      return {
        uid: data.uid,
        companyId: data.companyId,
      };
    } catch (error) {
      // エラーログを記録 / Log the error
      logger.error({
        sender,
        // Cloud Functions からのエラーメッセージがあればそれを使用、なければフォールバック / Use error message from Cloud Functions if available, otherwise fallback
        message: `Failed to create user with company: ${
          error.message || "An unknown error occurred during user creation."
        }`,
        error,
      });

      // エラーを再スローして呼び出し元に伝える / Re-throw the error to notify the caller
      throw error;
    } finally {
      // ローディング状態を必ず終了させる / Always end the loading state
      remove("createUserWithCompany");
    }
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
    add({
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
      logger.info({
        sender,
        message: `ユーザーアカウント「${displayName}」が正常に作成されました（uid: ${data.uid}）。`, // Administrator user "${displayName}" created successfully (uid: ${data.uid}).
      });

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
        sender,
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
      remove("createUserInCompany");
    }
  }

  async function disableUser({ uid }) {
    const { $functions } = useNuxtApp();

    add({
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

      logger.info({
        sender,
        message: `ユーザーアカウント ${uid} を無効化しました。`,
      });

      messages.add({
        text: "ユーザーアカウントを無効化しました",
        color: "success",
      });

      return { success: true };
    } catch (error) {
      logger.error({
        sender,
        message: `Failed to disable user ${uid}: ${
          error.message || "An unknown error occurred."
        }`,
        error,
      });
      throw error;
    } finally {
      remove("disableUser");
    }
  }

  async function enableUser({ uid }) {
    const { $functions } = useNuxtApp();

    add({
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

      logger.info({
        sender,
        message: `ユーザーアカウント ${uid} を有効化しました。`,
      });

      messages.add({
        text: "ユーザーアカウントを有効化しました",
        color: "success",
      });

      return { success: true };
    } catch (error) {
      logger.error({
        sender,
        message: `Failed to enable user ${uid}: ${
          error.message || "An unknown error occurred."
        }`,
        error,
      });
      throw error;
    } finally {
      remove("enableUser");
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
    clearUser,
    signIn,
    signOut,
    signUp,
    setUser,
    waitUntilReady,
    hasRole,
    createUserWithCompany,
    createUserInCompany,
    disableUser,
    enableUser,
  };
});
