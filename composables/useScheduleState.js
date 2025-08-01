import { ref, computed, watch, toRaw, unref } from "vue";
import { useErrorHandler } from "./useErrorHandler";
import { useMemoizedComputed } from "./usePerformanceOptimization";

/**
 * スケジュールの状態管理を行うコンポーザブル
 * - 楽観的更新のサポート
 * - スケジュールのフィルタリング・グループ化
 * - 更新の追跡
 * @param {Object} options - オプション設定
 * @param {Array|Ref} options.schedules - 元のスケジュールデータ
 * @returns {Object} スケジュール状態管理の機能
 */
export function useScheduleState({ schedules } = {}) {
  /** エラーハンドラーの初期化 */
  const errorHandler = useErrorHandler("useScheduleState");

  /** ローカル状態（楽観的更新用） */
  const localSchedules = ref([]);
  const pendingUpdates = ref(new Set()); // 更新中のスケジュールID
  const optimisticUpdates = ref(new Map()); // 楽観的更新の履歴

  /**
   * 元のスケジュールデータをローカル状態に同期
   */
  watch(
    schedules,
    (newSchedules) => {
      const resolvedSchedules = unref(newSchedules);

      if (Array.isArray(resolvedSchedules)) {
        localSchedules.value = [...resolvedSchedules];
        // 同期時に完了した更新をクリア
        clearCompletedUpdates(resolvedSchedules);
      }
    },
    { immediate: true, deep: true }
  );

  /**
   * 完了した楽観的更新をクリア
   */
  function clearCompletedUpdates(freshSchedules) {
    const freshIds = new Set(freshSchedules.map((s) => s.docId));

    // 削除された楽観的更新をクリア
    for (const [scheduleId] of optimisticUpdates.value) {
      if (!freshIds.has(scheduleId)) {
        optimisticUpdates.value.delete(scheduleId);
        pendingUpdates.value.delete(scheduleId);
      }
    }
  }

  /**
   * 特定の条件でスケジュールをフィルタリング（メモ化とエラーハンドリング付き）
   */
  const getSchedulesByCondition = useMemoizedComputed(
    () => {
      return (condition) => {
        try {
          if (typeof condition !== "function") {
            throw new Error("Condition must be a function");
          }
          return localSchedules.value.filter(condition);
        } catch (error) {
          const errorResult = errorHandler.handleError(error, {
            operation: "スケジュールのフィルタリング",
            silent: true,
          });
          return [];
        }
      };
    },
    [() => localSchedules.value],
    { deep: false, maxCacheSize: 50 }
  );

  /**
   * 現場ID・勤務区分・日付でスケジュールを取得（エラーハンドリング付き）
   */
  const getSchedulesByKey = computed(() => {
    return (siteId, shiftType, date) => {
      try {
        if (!siteId || !shiftType || !date) {
          return [];
        }

        return localSchedules.value.filter(
          (s) =>
            s?.siteId === siteId &&
            s?.shiftType === shiftType &&
            s?.date === date
        );
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          operation: "スケジュールのキー検索",
          details: `siteId: ${siteId}, shiftType: ${shiftType}, date: ${date}`,
          silent: true,
        });
        return [];
      }
    };
  });

  /**
   * スケジュールをマトリックス形式でグループ化（エラーハンドリング付き）
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
        const errorResult = errorHandler.handleError(error, {
          operation: "スケジュールマトリックスの作成",
          details: `rows: ${rows?.length}, columns: ${columns?.length}`,
          silent: true,
        });
        return [];
      }
    };
  });

  /**
   * 楽観的更新：スケジュールを即座にローカル状態に反映（エラーハンドリング付き）
   */
  const optimisticUpdate = (scheduleId, updateFn) => {
    try {
      if (!scheduleId || typeof updateFn !== "function") {
        throw new Error("Invalid scheduleId or updateFn");
      }

      const scheduleIndex = localSchedules.value.findIndex(
        (s) => s?.docId === scheduleId
      );

      if (scheduleIndex !== -1) {
        const originalSchedule = toRaw(localSchedules.value[scheduleIndex]);
        const updatedSchedule = updateFn(originalSchedule);

        if (!updatedSchedule) {
          throw new Error("UpdateFn must return a valid schedule object");
        }

        // 楽観的更新を記録
        optimisticUpdates.value.set(scheduleId, {
          original: originalSchedule,
          updated: updatedSchedule,
          timestamp: Date.now(),
        });

        // ローカル状態を即座に更新
        localSchedules.value[scheduleIndex] = updatedSchedule;
        pendingUpdates.value.add(scheduleId);

        return updatedSchedule;
      }

      return null;
    } catch (error) {
      const errorResult = errorHandler.handleError(error, {
        operation: "スケジュールの楽観的更新",
        details: `scheduleId: ${scheduleId}`,
      });
      return null;
    }
  };

  /**
   * スケジュールを追加（楽観的更新・エラーハンドリング付き）
   */
  const addScheduleOptimistically = (newSchedule) => {
    try {
      if (!newSchedule || typeof newSchedule !== "object") {
        throw new Error("New schedule must be a valid object");
      }

      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const scheduleWithTempId = { ...newSchedule, docId: tempId };

      localSchedules.value.push(scheduleWithTempId);
      pendingUpdates.value.add(tempId);

      return scheduleWithTempId;
    } catch (error) {
      const errorResult = errorHandler.handleError(error, {
        operation: "スケジュールの楽観的追加",
      });
      return null;
    }
  };

  /**
   * スケジュールを削除（楽観的更新・エラーハンドリング付き）
   */
  const removeScheduleOptimistically = (scheduleId) => {
    try {
      if (!scheduleId) {
        throw new Error("ScheduleId is required");
      }

      const scheduleIndex = localSchedules.value.findIndex(
        (s) => s?.docId === scheduleId
      );

      if (scheduleIndex !== -1) {
        const removedSchedule = localSchedules.value[scheduleIndex];
        localSchedules.value.splice(scheduleIndex, 1);
        pendingUpdates.value.add(scheduleId);

        return removedSchedule;
      }

      return null;
    } catch (error) {
      const errorResult = errorHandler.handleError(error, {
        operation: "スケジュールの楽観的削除",
        details: `scheduleId: ${scheduleId}`,
      });
      return null;
    }
  };

  /**
   * セルのスケジュール配列を更新（エラーハンドリング付き）
   */
  const updateCellSchedules = (newSchedules, siteId, shiftType, date) => {
    try {
      if (!Array.isArray(newSchedules)) {
        throw new Error("New schedules must be an array");
      }

      if (!siteId || !shiftType || !date) {
        throw new Error("SiteId, shiftType, and date are required");
      }

      // 現在のセルに該当しないスケジュールを保持
      const otherSchedules = localSchedules.value.filter(
        (s) =>
          !(
            s?.siteId === siteId &&
            s?.shiftType === shiftType &&
            s?.date === date
          )
      );

      // 新しいスケジュールと結合
      localSchedules.value = [...otherSchedules, ...newSchedules];

      return true;
    } catch (error) {
      const errorResult = errorHandler.handleError(error, {
        operation: "セルスケジュールの更新",
        details: `siteId: ${siteId}, shiftType: ${shiftType}, date: ${date}, schedules: ${newSchedules?.length}`,
      });
      return false;
    }
  };

  /**
   * 更新の完了を通知
   */
  const markUpdateComplete = (scheduleId) => {
    pendingUpdates.value.delete(scheduleId);
    optimisticUpdates.value.delete(scheduleId);
  };

  /**
   * 楽観的更新をロールバック
   */
  const rollbackOptimisticUpdate = (scheduleId) => {
    const update = optimisticUpdates.value.get(scheduleId);

    if (update) {
      const scheduleIndex = localSchedules.value.findIndex(
        (s) => s.docId === scheduleId
      );

      if (scheduleIndex !== -1) {
        localSchedules.value[scheduleIndex] = update.original;
      }

      optimisticUpdates.value.delete(scheduleId);
      pendingUpdates.value.delete(scheduleId);
    }
  };

  /**
   * 統計情報を取得（メモ化付き）
   */
  const statistics = useMemoizedComputed(
    () => {
      try {
        return {
          totalSchedules: localSchedules.value?.length || 0,
          pendingUpdatesCount: pendingUpdates.value?.size || 0,
          optimisticUpdatesCount: optimisticUpdates.value?.size || 0,
          schedulesByStatus:
            localSchedules.value?.reduce((acc, schedule) => {
              if (schedule?.status) {
                acc[schedule.status] = (acc[schedule.status] || 0) + 1;
              }
              return acc;
            }, {}) || {},
        };
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
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
      () => localSchedules.value,
      () => pendingUpdates.value,
      () => optimisticUpdates.value,
    ],
    { deep: true, maxCacheSize: 10 }
  );

  /**
   * フィルタリングされたスケジュール（エイリアス）
   */
  const filteredSchedules = computed(() => localSchedules.value);

  return {
    // 状態
    localSchedules,
    filteredSchedules,
    pendingUpdates,
    optimisticUpdates,
    statistics,

    // 取得・フィルタリング
    getSchedulesByCondition,
    getSchedulesByKey,
    createScheduleMatrix,

    // 楽観的更新
    optimisticUpdate,
    addScheduleOptimistically,
    removeScheduleOptimistically,
    updateCellSchedules,

    // 更新管理
    markUpdateComplete,
    rollbackOptimisticUpdate,

    // エラーハンドラー
    errorHandler,
  };
}
