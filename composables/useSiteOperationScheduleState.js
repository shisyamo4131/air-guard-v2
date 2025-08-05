import { computed } from "vue";
import { useOptimisticUpdates } from "./useOptimisticUpdates";
import { useErrorHandler } from "./useErrorHandler";
import { useMemoizedComputed } from "./usePerformanceOptimization";

/**
 * 現場稼働予定の状態管理を行うコンポーザブル
 * @param {Object} options - オプション設定
 * @param {Array|Ref} options.schedules - 元の現場稼働予定データ
 * @returns {Object} 現場稼働予定の状態管理機能
 */
export function useSiteOperationScheduleState({ schedules } = {}) {
  /** エラーハンドラーの初期化 */
  const errorHandler = useErrorHandler("useSiteOperationScheduleState");

  /** 楽観的更新機能を初期化 */
  const optimisticUpdates = useOptimisticUpdates({
    data: schedules,
    getItemId: (schedule) => schedule?.docId,
    contextName: "SiteOperationScheduleState",
  });

  /**
   * 現場ID・勤務区分・日付で現場稼働予定を取得
   */
  const getSchedulesByKey = computed(() => {
    return (siteId, shiftType, date) => {
      try {
        if (!siteId || !shiftType || !date) {
          return [];
        }

        return optimisticUpdates.localData.value.filter(
          (s) =>
            s?.siteId === siteId &&
            s?.shiftType === shiftType &&
            s?.date === date
        );
      } catch (error) {
        errorHandler.handleError(error, {
          operation: "現場稼働予定のキー検索",
          details: `siteId: ${siteId}, shiftType: ${shiftType}, date: ${date}`,
          silent: true,
        });
        return [];
      }
    };
  });

  /**
   * 現場稼働予定をマトリックス形式でグループ化
   */
  const createScheduleMatrix = computed(() => {
    return (rows, columns) => {
      try {
        if (!Array.isArray(rows) || !Array.isArray(columns)) {
          throw new Error("Rows and columns must be arrays");
        }

        const result = [];

        for (const row of rows) {
          if (!row) continue;

          const cells = [];

          for (const column of columns) {
            if (!column) continue;

            const matchingSchedules = getSchedulesByKey.value(
              row.siteId,
              row.shiftType,
              column.date
            );

            cells.push({
              schedules: matchingSchedules,
              column,
              row,
              key: `${row.siteId}-${row.shiftType}-${column.date}`,
              draggableName: `schedules-${row.siteId}-${row.shiftType}`,
            });
          }

          result.push({
            ...row,
            cells,
          });
        }

        return result;
      } catch (error) {
        errorHandler.handleError(error, {
          operation: "現場稼働予定マトリックスの作成",
          details: `rows: ${rows?.length}, columns: ${columns?.length}`,
          silent: true,
        });
        return [];
      }
    };
  });

  /**
   * セルの現場稼働予定配列を更新
   */
  const updateCellSchedules = (newSchedules, siteId, shiftType, date) => {
    return optimisticUpdates.batchUpdate(
      newSchedules,
      (s) =>
        s?.siteId === siteId && s?.shiftType === shiftType && s?.date === date
    );
  };

  /**
   * 統計情報を取得（メモ化付き）
   */
  const statistics = useMemoizedComputed(
    () => {
      try {
        return {
          totalSchedules: optimisticUpdates.localData.value?.length || 0,
          pendingUpdatesCount:
            optimisticUpdates.pendingUpdates.value?.size || 0,
          optimisticUpdatesCount:
            optimisticUpdates.optimisticUpdates.value?.size || 0,
          schedulesByStatus:
            optimisticUpdates.localData.value?.reduce((acc, schedule) => {
              if (schedule?.status) {
                acc[schedule.status] = (acc[schedule.status] || 0) + 1;
              }
              return acc;
            }, {}) || {},
        };
      } catch (error) {
        errorHandler.handleError(error, {
          operation: "統計情報の計算",
          silent: true,
        });
        return {
          totalSchedules: 0,
          pendingUpdatesCount: 0,
          optimisticUpdatesCount: 0,
          schedulesByStatus: {},
        };
      }
    },
    [
      () => optimisticUpdates.localData.value,
      () => optimisticUpdates.pendingUpdates.value,
      () => optimisticUpdates.optimisticUpdates.value,
    ],
    { deep: true, maxCacheSize: 10 }
  );

  return {
    // 状態（楽観的更新から委譲）
    localSchedules: optimisticUpdates.localData,
    filteredSchedules: optimisticUpdates.localData,
    pendingUpdates: optimisticUpdates.pendingUpdates,
    optimisticUpdates: optimisticUpdates.optimisticUpdates,
    statistics,

    // 取得・フィルタリング
    createScheduleMatrix,

    // 楽観的更新（委譲）
    optimisticUpdate: optimisticUpdates.optimisticUpdate,
    addScheduleOptimistically: optimisticUpdates.addOptimistically,
    removeScheduleOptimistically: optimisticUpdates.removeOptimistically,
    updateCellSchedules,

    // 更新管理（委譲）
    markUpdateComplete: optimisticUpdates.markUpdateComplete,
    rollbackOptimisticUpdate: optimisticUpdates.rollbackOptimisticUpdate,
    isPending: optimisticUpdates.isPending,

    // エラーハンドラー
    errorHandler,
  };
}
