import { computed, watch } from "vue";
import { Company, User, System } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useRolePresets } from "@/composables/useRolePresets";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

export const useAuthStore = defineStore("auth", () => {
  /***************************************************************************
   * DEFINE STORES AND COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("useAuthStore", useErrorsStore());

  /***************************************************************************
   * DEFINE STATES
   ***************************************************************************/
  const isDev = ref(process.env.NODE_ENV === "development"); // Development environment flag
  const isReady = ref(false); // Variable for navigation guards to check if the initial auth state check is complete.

  // User state
  const uid = ref(null);
  const isEmailVerified = ref(false);
  const isSuperUser = ref(false);
  const isDeveloper = ref(false);
  const companyId = ref(null);

  // Company state fetched by companyId
  const systemInstance = reactive(new System());
  const companyInstance = reactive(new Company());
  const userInstance = reactive(new User());

  /**
   * ユーザーが設定したタグ表示サイズを返します。
   * 未設定または不正な値の場合はMEDIUMを返します。
   */
  const tagSize = computed(() => {
    if (TAG_SIZE_VALUES[userInstance.tagSize]) {
      return userInstance.tagSize;
    }

    return TAG_SIZE_VALUES.MEDIUM.value;
  });

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
   * - プリセット役割: "manager", "controller", "accountant", "labor", "legal"
   * - 機能単位の権限: "sites:read", "sites:write" など
   */
  const roles = computed(() => {
    const result = [...(userInstance.roles || [])];
    if (isSuperUser.value) result.push("super-user");
    if (isDeveloper.value) result.push("developer");
    if (userInstance.isAdmin) result.push("admin");
    return result;
  });

  /**
   * 顧客タイプ（課金状態）
   *
   * @returns {'free' | 'paid' | 'expired'} 顧客の課金状態
   *
   * ## 顧客タイプの種類
   *
   * ### `free` (無料ユーザー)
   * - サブスクリプション未契約
   * - 従業員登録数が制限される（デフォルト: 5名まで）
   * - 一部機能が制限される可能性
   *
   * ### `paid` (有料ユーザー)
   * - 有効なサブスクリプション契約中
   * - プランに応じた従業員数まで登録可能
   * - すべての機能を利用可能
   *
   * ### `expired` (期限切れ)
   * - サブスクリプションが期限切れまたはキャンセル済み
   * - 新規データ作成不可
   * - 閲覧のみ可能（または完全にアクセス不可）
   */
  const customerType = computed(() => {
    const subscription = companyInstance?.subscription;

    // サブスクリプション情報がない場合は free
    if (!subscription || !subscription.id) {
      return "free";
    }

    // 期限切れチェック
    const status = subscription.status;
    const currentPeriodEnd = subscription.currentPeriodEnd;

    // キャンセル済み、支払い遅延、未払いの場合は expired
    if (["canceled", "past_due", "unpaid"].includes(status)) {
      return "expired";
    }

    // 期限が過去の場合は expired
    if (currentPeriodEnd && currentPeriodEnd.toMillis() < Date.now()) {
      return "expired";
    }

    // active または trialing の場合は paid
    if (["active", "trialing"].includes(status)) {
      return "paid";
    }

    // それ以外（incomplete など）は free 扱い
    return "free";
  });

  /**
   * Returns whether the application is currently in maintenance mode.
   * - Combines system-wide and company-specific maintenance states.
   * @returns {boolean} True if either system or company maintenance mode is active.
   */
  const isMaintenance = computed(() => {
    return (
      systemInstance?.isMaintenance || companyInstance?.maintenanceMode || false
    );
  });

  /***************************************************************************
   * METHODS
   ***************************************************************************/
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
          },
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
   * 指定された時間内にセッションがクリアされるのを待機します
   * @param {number} [timeoutMs=5000] - タイムアウトまでのミリ秒数
   * @returns {Promise<void>} - セッションがクリアされると解決される Promise
   * @throws {Error} - 指定時間内にセッションがクリアされなかった場合にタイムアウトエラーをスローします。
   */
  async function waitUntilSessionCleared(timeoutMs = 5000) {
    // 既にセッションがクリアされている場合は即座にリターン
    // `uid` と `isReady` の値を以てセッションがクリアされたと判断する
    if (uid.value === null && isReady.value) return;

    let watcherStop = null;
    let timeoutId = null;

    try {
      // `uid` が null かつ `isReady` が true になるまで待機する Promise
      await new Promise((resolve, reject) => {
        watcherStop = watch(
          () => [uid.value, isReady.value],
          ([currentUid, currentIsReady]) => {
            if (currentUid === null && currentIsReady) resolve();
          },
        );
        // タイムアウト処理を設定
        timeoutId = setTimeout(() => {
          const message = `waitUntilSessionCleared timed out after ${timeoutMs}ms.`;
          logger.warn({ message });
          reject(new Error(message));
        }, timeoutMs);
      });
    } finally {
      watcherStop?.();
      clearTimeout(timeoutId);
    }
  }

  /**
   * 指定されたロールを保持しているかどうかを判定します
   * @param {string} role - チェック対象のロール（例: "controller"）
   * @returns {boolean} - 指定ロールを持つ場合は true
   */
  function hasRole(role) {
    return roles.value.includes(role);
  }

  /**
   * 指定された権限を保持しているかどうかを判定します
   * - 役割プリセット（manager, controller など）から展開された権限もチェック
   * - admin と super-user はすべての権限を持つ
   *
   * @param {string} permission - チェック対象の権限（例: "sites:write"）
   * @returns {boolean} - 指定権限を持つ場合は true
   *
   * @example
   * // controller ロールを持つユーザー
   * hasPermission('sites:write') // → true (controller に含まれる)
   * hasPermission('billings:write') // → false (controller には含まれない)
   *
   * // admin ロールを持つユーザー
   * hasPermission('sites:write') // → true (すべての権限)
   * hasPermission('billings:write') // → true (すべての権限)
   */
  function hasPermission(permission) {
    const { getPermissions } = useRolePresets();
    const permissions = getPermissions(roles.value);

    // すべての権限を持つ場合
    if (permissions.includes("*")) return true;

    // 特定の権限を持つ場合
    return permissions.includes(permission);
  }

  // pinia を使う場合、return で公開されるものは自動的にリアクティブになる。
  // また、ref で定義されたプロパティも .value を意識せずにアクセス可能。
  // ただし、分割代入を行うとリアクティブ性が失われることに注意。
  return {
    user: userInstance,
    uid,
    email: computed(() => userInstance.email),
    displayName: computed(() => userInstance.displayName),
    isEmailVerified,
    isAdmin: computed(() => userInstance.isAdmin),
    tagSize,
    employeeId: computed(() => userInstance.employeeId),
    isReady,
    roles,
    companyId,
    isSuperUser,
    isDeveloper,
    company: companyInstance, // companyInstance を company として返す
    isMaintenance,
    isDev,
    customerType, // ← 追加
    system: systemInstance,
    waitUntilReady,
    waitUntilSessionCleared,
    hasRole,
    hasPermission,
  };
});
