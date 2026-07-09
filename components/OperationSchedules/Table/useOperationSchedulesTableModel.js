/*****************************************************************************
 * @file ./components/OperationSchedules/Table/OperationSchedulesTableModel.js
 * @description `OperationSchedulesTable` 専用 DDD コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationSchedulesMapByOrderKey } from "@/composables/transforms/useSiteOperationSchedulesMapByOrderKey";
import { useSiteOperationSchedulesMapByGroupKey } from "@/composables/transforms/useSiteOperationSchedulesMapByGroupKey";

export function useOperationSchedulesTableModel(props) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  /** DATE RANGE COMPOSABLE */
  const dateRangeComposable = useDateRange();
  const { daysInRangeArray, dateRange } = dateRangeComposable;
  Vue.watch(
    () => [props.startDate, props.endDate],
    ([newStartDate, newEndDate]) => {
      dateRange.value = { from: newStartDate, to: newEndDate };
    },
    { immediate: true },
  );

  /**
   * useSiteOperationSchedulesMapByOrderKey
   * 現場稼働予定を現場オーダーキーごとに分類したマップに変換
   * {
   *  orderKey: {
   *    schedules: Array,
   *    count: Number,
   *    hasMultiple: Boolean,
   *  }
   */
  const schedulesMapByOrderKey = useSiteOperationSchedulesMapByOrderKey(
    () => props.schedules,
  );

  /**
   * useSiteOperationSchedulesMapByGroupKey
   * 現場稼働予定をグループキーごとに分類したマップ（cell スロットで使用）に変換
   * {
   *  groupKey: {
   *   schedules: Array,
   *   count: Number,
   *   hasMultiple: Boolean,
   *   requiredPersonnel: Number,
   * }
   */
  const schedulesMapByGroupKey = useSiteOperationSchedulesMapByGroupKey(
    () => props.schedules,
    true,
  );

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * テーブルのセルに適用する色クラスを返します。
   * - 色クラスは `props.columnColors` を参照します。
   * - 今日の場合は黄色を返します。
   * - 祝日の場合は日曜と同じ色を返します。
   * @param {Object} column - カラムオブジェクト
   * @param {string} column.date - 日付文字列（YYYY-MM-DD）
   * @param {Date} column.dateAt - Dateオブジェクト
   * @param {string} column.weekday - 曜日文字列（例: "Mon"）
   * @param {Function} column.format - 指定フォーマットで日付を返す関数
   * @param {boolean} column.isToday - 今日かどうか
   * @param {boolean} column.isPreviousDay - 過去日かどうか
   * @param {boolean} column.isFuture - 未来日かどうか
   * @param {boolean} column.isHoliday - 祝日かどうか
   * @returns {String} - 色クラス
   */
  function getCellColorClass(column) {
    // 今日の場合は黄色を返す
    const isToday = column.isToday;
    if (isToday) return `bg-yellow-lighten-4`;

    // 祝日の場合は日曜と同じ色を返す
    const isHoliday = column.isHoliday;
    if (isHoliday) return props.columnColors[0];

    // 曜日を取得して対応する色を返す
    const dayOfWeek = column.dateAt.getDay();
    return props.columnColors[dayOfWeek];
  }

  /**
   * 引数で与えられたサイズ情報を style に適用できるよう解決して返します。
   * @param {string|number|undefined} size
   * @returns {String|undefined} - 解決されたサイズ文字列または undefined
   */
  const resolveSize = (size) => {
    if (!size) return undefined;
    return typeof size === "number" ? `${size}px` : size;
  };

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * カラム幅を解決して返します。
   */
  const resolvedColumnWidth = Vue.computed(() => {
    return resolveSize(props.columnWidth);
  });

  /**
   * 日付セルの高さを解決して返します。
   */
  const resolvedDayHeight = Vue.computed(() => {
    return resolveSize(props.dayHeight);
  });

  /**
   * 曜日セルの高さを解決して返します。
   */
  const resolvedWeekdayHeight = Vue.computed(() => {
    return resolveSize(props.weekdayHeight);
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    columns: Vue.computed(() =>
      daysInRangeArray.value.map((column) => {
        return {
          ...column,
          colorClass: getCellColorClass(column),
          style: {
            col: {
              width: resolvedColumnWidth.value,
              minWidth: resolvedColumnWidth.value,
            },
            day: {
              height: resolvedDayHeight.value,
            },
            weekday: {
              height: resolvedWeekdayHeight.value,
            },
          },
        };
      }),
    ),
    rows: Vue.toRef(props, "siteShiftTypeOrder"),
    schedulesIndex: Vue.computed(() => {
      return {
        orderKey: schedulesMapByOrderKey.value,
        groupKey: schedulesMapByGroupKey.value,
      };
    }),
  };
}
