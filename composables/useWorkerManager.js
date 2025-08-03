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
 * 作業員（従業員・外注先）の統一管理コンポーザブル
 * - 従業員・外注先データの取得とキャッシュ
 * - 作業員選択用データの提供
 * - アクティブな作業員データの管理
 * - 重複チェック機能
 * @param {Object} options - オプション設定
 * @param {Object} options.fetchEmployeeComposable - 既存の従業員取得コンポーザブル
 * @param {Object} options.fetchOutsourcerComposable - 既存の外注先取得コンポーザブル
 * @returns {Object} 作業員管理の機能
 */
export function useWorkerManager({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /** エラーハンドラーとロガーの初期化 */
  const errorHandler = useErrorHandler("useWorkerManager");
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

  /** ライフサイクルフック - マウント時に初期化 */
  onMounted(async () => {
    await initialize();
  });

  /**
   * アクティブな作業員データを初期化
   */
  const initialize = async () => {
    return errorHandler.safeAsyncExecution(
      async () => {
        await Promise.all([initializeEmployees(), initializeOutsourcers()]);
      },
      {
        operation: "作業員データの初期化",
        retryOptions: { maxRetries: 2 },
      }
    );
  };

  /**
   * アクティブな従業員を初期化
   */
  const initializeEmployees = async () => {
    try {
      const constraints = [
        ["where", "employmentStatus", "==", EMPLOYMENT_STATUS_ACTIVE],
      ];
      const fetchedDocs = await employeeInstance.fetchDocs({ constraints });

      // キャッシュに追加
      pushEmployees(fetchedDocs);

      // 選択用データとして設定
      availableEmployees.value = fetchedDocs.map((doc) => {
        return new OperationResultDetail({
          workerId: doc.docId,
          isEmployee: true,
        });
      });
    } catch (error) {
      throw new Error(`従業員データの初期化に失敗: ${error.message}`);
    }
  };

  /**
   * アクティブな外注先を初期化
   */
  const initializeOutsourcers = async () => {
    try {
      const constraints = [
        ["where", "contractStatus", "==", CONTRACT_STATUS_ACTIVE],
      ];
      const fetchedDocs = await outsourcerInstance.fetchDocs({ constraints });

      // キャッシュに追加
      pushOutsourcers(fetchedDocs);

      // 選択用データとして設定
      availableOutsourcers.value = fetchedDocs.map((doc) => {
        return new OperationResultDetail({
          workerId: doc.docId,
          isEmployee: false,
        });
      });
    } catch (error) {
      throw new Error(`外注先データの初期化に失敗: ${error.message}`);
    }
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
    initializeEmployees,
    initializeOutsourcers,

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
