/**
 * 2025-10-18
 * 配置管理の初回画面ロードに時間がかかるため、useFetchEmployee と useFetchOutsourcer を
 * 必ず外部から指定するように一旦変更。
 */
import { computed, ref, reactive } from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
// import { useFetchEmployee } from "./fetch/useFetchEmployee";
// import { useFetchOutsourcer } from "./fetch/useFetchOutsourcer";
import { useLogger } from "./useLogger";
import { Employee, Outsourcer } from "@/schemas";

/**
 * 作業員（従業員・外注先）リスト提供コンポーザブル
 * - アクティブな作業員の選択用リスト提供
 * - 作業員情報の取得とキャッシュ
 * - 現場稼働予定の配置管理との連携
 * @param {Object} options - オプション設定
 * @param {Object} options.fetchEmployeeComposable - 既存の従業員取得コンポーザブル
 * @param {Object} options.fetchOutsourcerComposable - 既存の外注先取得コンポーザブル
 * @returns {Object} 作業員リスト提供の機能
 */
export function useWorkersList({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /** ロガーの初期化 */
  const logger = useLogger("useWorkersList", useErrorsStore());

  /** 既存のコンポーザブルを使用または新規作成 */
  // const employeeComposable = fetchEmployeeComposable || useFetchEmployee();
  // const outsourcerComposable =
  //   fetchOutsourcerComposable || useFetchOutsourcer();
  const employeeComposable = fetchEmployeeComposable;
  const outsourcerComposable = fetchOutsourcerComposable;

  /** 既存のコンポーザブルから必要なデータを取得 */
  const { cachedEmployees, fetchEmployee, pushEmployees } = employeeComposable;
  const { cachedOutsourcers, fetchOutsourcer, pushOutsourcers } =
    outsourcerComposable;

  /** スキーマインスタンス */
  const employeeInstance = reactive(new Employee());
  const outsourcerInstance = reactive(new Outsourcer());

  /** 作業員選択用データ */
  const availableEmployees = ref([]);
  const availableOutsourcers = ref([]);

  /**
   * アクティブな作業員データを初期化
   */
  const initialize = async () => {
    try {
      await Promise.all([_initEmployees(), _initOutsourcers()]);
      logger.info({
        message: "作業員データの初期化が完了しました",
      });
      return {
        success: true,
        data: null,
        error: null,
      };
    } catch (error) {
      logger.error({
        message: "作業員データの初期化に失敗しました",
        error,
      });
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  };

  /**
   * 作業員データを初期化する内部関数
   * @param {Object} config - 初期化設定
   * @param {Object} config.instance - スキーマインスタンス
   * @param {Array} config.constraints - 取得条件
   * @param {Function} config.pushToCache - キャッシュ追加関数
   * @param {Object} config.targetRef - 格納先のref
   * @param {string} config.type - エラーメッセージ用の種別名
   */
  const _initWorker = async ({
    instance,
    constraints,
    pushToCache,
    targetRef,
    type,
  }) => {
    try {
      targetRef.value = await instance.fetchDocs({ constraints });
      pushToCache(targetRef.value);
      logger.info({
        message: `${type}データの初期化が完了しました（${targetRef.value.length}件）`,
      });
    } catch (error) {
      logger.error({
        message: `${type}データの初期化に失敗しました`,
        error,
      });
      throw new Error(`${type}データの初期化に失敗: ${error.message}`);
    }
  };

  /**
   * アクティブな従業員を初期化（内部関数）
   */
  const _initEmployees = async () => {
    return _initWorker({
      instance: employeeInstance,
      constraints: [
        ["where", "employmentStatus", "==", Employee.STATUS_ACTIVE],
      ],
      pushToCache: pushEmployees,
      targetRef: availableEmployees,
      type: "従業員",
    });
  };

  /**
   * アクティブな外注先を初期化（内部関数）
   */
  const _initOutsourcers = async () => {
    return _initWorker({
      instance: outsourcerInstance,
      constraints: [
        ["where", "contractStatus", "==", Outsourcer.STATUS_ACTIVE],
      ],
      pushToCache: pushOutsourcers,
      targetRef: availableOutsourcers,
      type: "外注先",
    });
  };

  /**
   * 全作業員（従業員+外注先）のリスト
   */
  const allWorkers = computed(() => [
    ...(availableEmployees.value || []),
    ...(availableOutsourcers.value || []),
  ]);

  /**
   * 統計情報
   */
  const statistics = computed(() => {
    try {
      return {
        totalEmployees: availableEmployees.value?.length || 0,
        totalOutsourcers: availableOutsourcers.value?.length || 0,
        totalWorkers: allWorkers.value?.length || 0,
        cachedEmployees: Object.keys(cachedEmployees.value || {}).length,
        cachedOutsourcers: Object.keys(cachedOutsourcers.value || {}).length,
      };
    } catch (error) {
      logger.error({
        message: "統計情報の取得に失敗しました",
        error,
      });
      return {
        totalEmployees: 0,
        totalOutsourcers: 0,
        totalWorkers: 0,
        cachedEmployees: 0,
        cachedOutsourcers: 0,
      };
    }
  });

  const getWorker = ({ id, isEmployee }) => {
    try {
      if (isEmployee) {
        return cachedEmployees.value[id];
      }
      return cachedOutsourcers.value[id];
    } catch (error) {
      logger.error({
        message: `作業員データの取得に失敗しました (ID: ${id}, isEmployee: ${isEmployee})`,
        error,
      });
      return null;
    }
  };

  return {
    // 元のコンポーザブル
    employeeComposable,
    outsourcerComposable,

    // キャッシュデータ
    cachedEmployees,
    cachedOutsourcers,

    // 選択用データ
    availableEmployees,
    availableOutsourcers,
    allWorkers,

    // 初期化
    initialize,

    // ワーカー取得
    getWorker,

    // 統計情報
    statistics,

    // 元の関数（後方互換性）
    fetchEmployee,
    fetchOutsourcer,
  };
}
