import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
} from "firebase/auth";
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
  const companyInstance = reactive(new Company());
  const userInstance = reactive(new User());

  // Whether the app is in maintenance mode
  const isMaintenance = ref(false);

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * ユーザーの権限（ロール）
   *
   * @returns {Array<string>} ユーザーが持つすべてのロール
   *
   * ## ロールの種類
   *
   * ### `super-user` (システム管理者)
   * - カスタムクレーム `isSuperUser` により自動付与
   * - すべての会社（Companies コレクション）のデータを閲覧・編集可能
   * - システム全体の管理機能にアクセス可能
   *
   * ### `admin` (会社管理者)
   * - User ドキュメントの `isAdmin` プロパティにより自動付与
   * - 自社（所属する Company）のすべての機能を利用可能
   * - 他社のデータにはアクセス不可
   *
   * ### その他のロール
   * - User ドキュメントの `roles` 配列で管理
   * - 会社内での役割・権限を細かく制御
   * - 例: "operation-manager", "billing-staff", "viewer" など
   */
  const roles = computed(() => {
    const result = [...(userInstance.roles || [])]; // 配列をコピー
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
      if (!companyInstance?.minuteInterval) return true;
      return val % companyInstance.minuteInterval === 0;
    };

    // Update `RoundSetting` global setting based on company settings
    RoundSetting.set(companyInstance?.roundSetting || RoundSetting.ROUND);
  });

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  async function setUser(user) {
    errors.clear();
    isReady.value = false;
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
        await companyInstance.fetch({ docId: companyId.value });
        userInstance.subscribe({ docId: uid.value });
        companyInstance.subscribe({ docId: companyId.value });
      } else {
        userInstance.unsubscribe();
        userInstance.initialize();
        companyInstance.unsubscribe();
        companyInstance.initialize();
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

      // Firebase Authentication でサインアウトを実行 / Execute sign-out with Firebase Authentication
      await authSignOut($auth);

      // 成功メッセージを追加 / Add success message
      messages.add("サインアウトしました");

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

  // pinia を使う場合、return で公開されるものは自動的にリアクティブになる。
  // また、ref で定義されたプロパティも .value を意識せずにアクセス可能。
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
    company: companyInstance, // companyInstance を company として返す
    isMaintenance,
    isDev,
    signIn,
    signOut,
    setUser,
    waitUntilReady,
    hasRole,
  };
});
