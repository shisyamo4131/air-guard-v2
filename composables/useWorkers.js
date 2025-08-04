import { computed, ref, reactive, onMounted } from "vue";
import { useFetchEmployee } from "./fetch/useFetchEmployee";
import { useFetchOutsourcer } from "./fetch/useFetchOutsourcer";
import { useErrorHandler } from "./useErrorHandler";
import { useLogger } from "./useLogger";
import { useMemoizedComputed } from "./usePerformanceOptimization";
import { Employee, Outsourcer, OperationResultDetail } from "@/schemas";
import {
  CONTRACT_STATUS_ACTIVE,
  EMPLOYMENT_STATUS_ACTIVE,
} from "air-guard-v2-schemas/constants";

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
export function useWorkers({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /** エラーハンドラーとロガーの初期化 */
  const errorHandler = useErrorHandler("useWorkers");
  const logger = useLogger();

  /** 既存のコンポーザブルを使用または新規作成 */
  const employeeComposable = fetchEmployeeComposable || useFetchEmployee();
  const outsourcerComposable =
    fetchOutsourcerComposable || useFetchOutsourcer();

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
    return errorHandler.safeAsyncExecution(
      async () => {
        await Promise.all([_initEmployees(), _initOutsourcers()]);
      },
      {
        operation: "作業員データの初期化",
        retryOptions: { maxRetries: 2 },
      }
    );
  };

  /**
   * 作業員データを初期化する内部関数
   * @param {Object} config - 初期化設定
   * @param {Object} config.instance - スキーマインスタンス
   * @param {Array} config.constraints - 取得条件
   * @param {Function} config.pushToCache - キャッシュ追加関数
   * @param {Object} config.targetRef - 格納先のref
   * @param {boolean} config.isEmployee - 従業員フラグ
   * @param {string} config.type - エラーメッセージ用の種別名
   */
  const _initWorker = async ({
    instance,
    constraints,
    pushToCache,
    targetRef,
    isEmployee,
    type,
  }) => {
    try {
      const fetchedDocs = await instance.fetchDocs({ constraints });

      // キャッシュに追加
      pushToCache(fetchedDocs);

      // OperationResultDetail形式で選択用データを設定
      targetRef.value = fetchedDocs.map((doc) => {
        return new OperationResultDetail({
          workerId: doc.docId,
          isEmployee,
        });
      });
    } catch (error) {
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
        ["where", "employmentStatus", "==", EMPLOYMENT_STATUS_ACTIVE],
      ],
      pushToCache: pushEmployees,
      targetRef: availableEmployees,
      isEmployee: true,
      type: "従業員",
    });
  };

  /**
   * アクティブな外注先を初期化（内部関数）
   */
  const _initOutsourcers = async () => {
    return _initWorker({
      instance: outsourcerInstance,
      constraints: [["where", "contractStatus", "==", CONTRACT_STATUS_ACTIVE]],
      pushToCache: pushOutsourcers,
      targetRef: availableOutsourcers,
      isEmployee: false,
      type: "外注先",
    });
  };

  /**
   * 作業員をIDで取得（エラーハンドリング付き）
   * @param {string} workerId - 作業員のID
   * @param {boolean} isEmployee - 従業員かどうか
   * @returns {Object|null} - 作業員データまたはnull
   */
  const getWorkerById = computed(() => {
    return ({ workerId, isEmployee = true }) => {
      try {
        if (!workerId) return null;

        const cache = isEmployee
          ? cachedEmployees.value
          : cachedOutsourcers.value;
        return cache[workerId] || null;
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "作業員データの取得",
          details: `ID: ${workerId}, isEmployee: ${isEmployee}`,
          silent: true,
        });
        return null;
      }
    };
  });

  /**
   * 作業員の表示名を取得（エラーハンドリング付き）
   * @param {string} workerId - 作業員のID
   * @param {boolean} isEmployee - 従業員かどうか
   * @returns {string|null} - 表示名またはnull
   */
  const getWorkerName = computed(() => {
    return ({ workerId, isEmployee = true }) => {
      try {
        // workerId が未指定の場合は null を返す
        if (!workerId) return null;

        // worker データを取得 -> 存在しなければ null を返す
        const worker = getWorkerById.value({ workerId, isEmployee });
        if (!worker) return null;

        // 表示名として有効なフィールド名を優先順位で取得
        const validName = ["displayName", "name", "fullName"].find((field) =>
          worker?.[field]?.trim()
        );

        // 表示名として有効なフィールド名が取得できた場合のみ文字列を返す
        return validName ? worker[validName] : `Unknown Worker (${workerId})`;
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "作業員表示名の取得",
          details: `ID: ${workerId}, isEmployee: ${isEmployee}`,
          silent: true,
        });
        return null;
      }
    };
  });

  /**
   * 全作業員（従業員+外注先）のリスト（メモ化付き）
   */
  const allWorkers = useMemoizedComputed(
    () => [
      ...(availableEmployees.value || []),
      ...(availableOutsourcers.value || []),
    ],
    [() => availableEmployees.value, () => availableOutsourcers.value],
    { deep: false, maxCacheSize: 20 }
  );

  /**
   * 統計情報（メモ化とエラーハンドリング付き）
   */
  const statistics = useMemoizedComputed(
    () => {
      try {
        return {
          totalEmployees: availableEmployees.value?.length || 0,
          totalOutsourcers: availableOutsourcers.value?.length || 0,
          totalWorkers: allWorkers.value?.length || 0,
          cachedEmployees: Object.keys(cachedEmployees.value || {}).length,
          cachedOutsourcers: Object.keys(cachedOutsourcers.value || {}).length,
        };
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "統計情報の取得",
          silent: true,
        });
        return {
          totalEmployees: 0,
          totalOutsourcers: 0,
          totalWorkers: 0,
          cachedEmployees: 0,
          cachedOutsourcers: 0,
        };
      }
    },
    [
      () => availableEmployees.value,
      () => availableOutsourcers.value,
      () => cachedEmployees.value,
      () => cachedOutsourcers.value,
    ],
    { deep: false, maxCacheSize: 10 }
  );

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

    // 取得・検索機能
    getWorkerById,
    getWorkerName,

    // 統計情報
    statistics,

    // エラーハンドラー
    errorHandler,

    // 元の関数（後方互換性）
    fetchEmployee,
    fetchOutsourcer,
  };
}
