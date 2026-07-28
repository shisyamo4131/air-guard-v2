import { computed, watch } from "vue";
import { User } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import {
  buildRoles,
  getPermissions,
  hasPermission as checkPermission,
  hasRole as checkRole,
} from "@/utils/auth/authorization";

export const useAuthStore = defineStore("auth", () => {
  /***************************************************************************
   * DEFINE STORES AND COMPOSABLES
  ***************************************************************************/
  const logger = useLogger("useAuthStore", useErrorsStore());

  /***************************************************************************
   * DEFINE STATES
   ***************************************************************************/
  const isReady = ref(false); // Variable for navigation guards to check if the initial auth state check is complete.

  // User state
  const uid = ref(null);
  const isEmailVerified = ref(false);
  const isSuperUser = ref(false);
  const isDeveloper = ref(false);
  const companyId = ref(null);

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
    return buildRoles({
      roles: userInstance.roles,
      isSuperUser: isSuperUser.value,
      isDeveloper: isDeveloper.value,
      isAdmin: userInstance.isAdmin,
    });
  });

  const permissions = computed(() => getPermissions(roles.value));

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * 指定された条件を満たすまで待機します。
   * @param {() => boolean} condition - 待機条件
   * @param {Object} [options] - オプション
   * @param {number} [options.timeoutMs=5000] - タイムアウトまでのミリ秒数
   * @param {string} [options.timeoutMessage] - タイムアウト時のメッセージ
   * @returns {Promise<void>} - 条件を満たすと解決される Promise
   * @throws {Error} - 指定時間内に条件を満たさなかった場合
   */
  async function waitUntil(
    condition,
    {
      timeoutMs = 5000,
      timeoutMessage = `waitUntil timed out after ${timeoutMs}ms.`,
    } = {},
  ) {
    let watcherStop = null;
    let timeoutId = null;

    try {
      await new Promise((resolve, reject) => {
        watcherStop = watch(
          condition,
          (satisfied) => {
            if (satisfied) resolve();
          },
          { immediate: true },
        );

        timeoutId = setTimeout(() => {
          logger.warn({ message: timeoutMessage });
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      });
    } finally {
      watcherStop?.();
      clearTimeout(timeoutId);
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
    return waitUntil(() => isReady.value, {
      timeoutMs,
      timeoutMessage: `waitUntilReady timed out after ${timeoutMs}ms.`,
    });
  }

  /**
   * 指定された時間内にセッションがクリアされるのを待機します
   * @param {number} [timeoutMs=5000] - タイムアウトまでのミリ秒数
   * @returns {Promise<void>} - セッションがクリアされると解決される Promise
   * @throws {Error} - 指定時間内にセッションがクリアされなかった場合にタイムアウトエラーをスローします。
   */
  async function waitUntilSessionCleared(timeoutMs = 5000) {
    return waitUntil(() => uid.value === null && isReady.value, {
      timeoutMs,
      timeoutMessage: `waitUntilSessionCleared timed out after ${timeoutMs}ms.`,
    });
  }

  /**
   * 指定されたロールを保持しているかどうかを判定します
   * @param {string} role - チェック対象のロール（例: "controller"）
   * @returns {boolean} - 指定ロールを持つ場合は true
   */
  function hasRole(role) {
    return checkRole(roles.value, role);
  }

  /**
   * 指定された権限を保持しているかどうかを判定します
   * - 役割プリセット（manager, controller など）から展開された権限もチェック
   * - super-user はすべての権限を持つ
   *
   * @param {string} permission - チェック対象の権限（例: "sites:write"）
   * @returns {boolean} - 指定権限を持つ場合は true
   *
   * @example
   * // controller ロールを持つユーザー
   * hasPermission('sites:write') // → true (controller に含まれる)
   * hasPermission('billings:write') // → false (controller には含まれない)
   *
   * // super-user ロールを持つユーザー
   * hasPermission('sites:write') // → true (すべての権限)
   * hasPermission('billings:write') // → true (すべての権限)
   */
  function hasPermission(permission) {
    return checkPermission(permissions.value, permission);
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
    waitUntilReady,
    waitUntilSessionCleared,
    hasRole,
    hasPermission,
  };
});
