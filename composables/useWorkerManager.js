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
   * 全作業員（従業員+外注先）のリスト（メモ化付き）
   */
  const allWorkers = useMemoizedComputed(
    () => {
      try {
        const employeeList = (availableEmployees.value || []).map((emp) => ({
          ...emp,
          isEmployee: true,
          type: "employee",
          displayName: emp?.displayName || emp?.name || "Unknown Employee",
        }));

        const outsourcerList = (availableOutsourcers.value || []).map(
          (out) => ({
            ...out,
            isEmployee: false,
            type: "outsourcer",
            displayName: out?.displayName || out?.name || "Unknown Outsourcer",
          })
        );

        return [...employeeList, ...outsourcerList];
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "全作業員リストの生成",
          silent: true,
        });
        return [];
      }
    },
    [() => availableEmployees.value, () => availableOutsourcers.value],
    { deep: false, maxCacheSize: 20 }
  );

  /**
   * 作業員をIDで取得（エラーハンドリング付き）
   */
  const getWorkerById = computed(() => {
    return (workerId, isEmployee = true) => {
      try {
        if (!workerId) {
          return null;
        }

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
   */
  const getWorkerDisplayName = computed(() => {
    return (workerId, isEmployee = true) => {
      try {
        if (!workerId) {
          return "Unknown Worker (No ID)";
        }

        const worker = getWorkerById.value(workerId, isEmployee);
        if (!worker) {
          return `Unknown Worker (${workerId})`;
        }

        const displayName =
          worker.displayName && worker.displayName.trim() !== ""
            ? worker.displayName
            : null;
        const name =
          worker.name && worker.name.trim() !== "" ? worker.name : null;
        const fullName =
          worker.fullName && worker.fullName.trim() !== ""
            ? worker.fullName
            : null;

        return (
          displayName || name || fullName || `Unknown Worker (${workerId})`
        );
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "作業員表示名の取得",
          details: `ID: ${workerId}, isEmployee: ${isEmployee}`,
          silent: true,
        });
        return `Error: ${workerId}`;
      }
    };
  });

  /**
   * 作業員が存在するかチェック（エラーハンドリング付き）
   */
  const workerExists = computed(() => {
    return (workerId, isEmployee = true) => {
      try {
        if (!workerId) return false;
        return getWorkerById.value(workerId, isEmployee) !== null;
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "作業員存在チェック",
          details: `ID: ${workerId}, isEmployee: ${isEmployee}`,
          silent: true,
        });
        return false;
      }
    };
  });

  /**
   * 複数の作業員を一括取得（エラーハンドリング付き）
   */
  const fetchWorkers = async (workerList) => {
    return errorHandler.safeAsyncExecution(
      async () => {
        if (!Array.isArray(workerList)) {
          throw new Error("workerList must be an array");
        }

        const employees = workerList
          .filter((w) => w?.isEmployee)
          .map((w) => w.workerId)
          .filter(Boolean);
        const outsourcers = workerList
          .filter((w) => !w?.isEmployee)
          .map((w) => w.workerId)
          .filter(Boolean);

        const promises = [];
        if (employees.length > 0) {
          promises.push(fetchEmployee(employees));
        }
        if (outsourcers.length > 0) {
          promises.push(fetchOutsourcer(outsourcers));
        }

        await Promise.all(promises);
        return { employees: employees.length, outsourcers: outsourcers.length };
      },
      {
        operation: "作業員データの一括取得",
        retryOptions: { maxRetries: 2 },
      }
    );
  };

  /**
   * 検索機能（エラーハンドリング付き）
   */
  const searchWorkers = computed(() => {
    return (query, options = {}) => {
      try {
        const {
          includeEmployees = true,
          includeOutsourcers = true,
          limit = 50,
        } = options;

        if (!query || typeof query !== "string" || query.trim() === "") {
          return [];
        }

        const normalizedQuery = query.toLowerCase().trim();

        let results = [];

        if (includeEmployees) {
          const employeeMatches = availableEmployees.value
            .filter((emp) => {
              if (!emp) return false;

              const displayName = (emp.displayName || "").toLowerCase();
              const name = (emp.name || "").toLowerCase();
              const code = (emp.code || "").toLowerCase();

              return (
                displayName.includes(normalizedQuery) ||
                name.includes(normalizedQuery) ||
                code.includes(normalizedQuery)
              );
            })
            .map((emp) => ({ ...emp, isEmployee: true, type: "employee" }));

          results.push(...employeeMatches);
        }

        if (includeOutsourcers) {
          const outsourcerMatches = availableOutsourcers.value
            .filter((out) => {
              if (!out) return false;

              const displayName = (out.displayName || "").toLowerCase();
              const name = (out.name || "").toLowerCase();
              const code = (out.code || "").toLowerCase();

              return (
                displayName.includes(normalizedQuery) ||
                name.includes(normalizedQuery) ||
                code.includes(normalizedQuery)
              );
            })
            .map((out) => ({ ...out, isEmployee: false, type: "outsourcer" }));

          results.push(...outsourcerMatches);
        }

        // 関連度でソート（完全一致を優先）
        results.sort((a, b) => {
          const aDisplay = (a.displayName || a.name || "").toLowerCase();
          const bDisplay = (b.displayName || b.name || "").toLowerCase();

          const aExact = aDisplay === normalizedQuery ? 1 : 0;
          const bExact = bDisplay === normalizedQuery ? 1 : 0;

          if (aExact !== bExact) return bExact - aExact;

          const aStarts = aDisplay.startsWith(normalizedQuery) ? 1 : 0;
          const bStarts = bDisplay.startsWith(normalizedQuery) ? 1 : 0;

          return bStarts - aStarts;
        });

        return results.slice(0, Math.max(1, parseInt(limit) || 50));
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "作業員検索",
          details: `検索クエリ: ${query}`,
          silent: true,
        });
        return [];
      }
    };
  });

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
    getWorkerDisplayName,
    workerExists,
    fetchWorkers,
    searchWorkers,

    // 統計情報
    statistics,

    // エラーハンドラー
    errorHandler,

    // 元の関数（後方互換性）
    fetchEmployee,
    fetchOutsourcer,
  };
}
