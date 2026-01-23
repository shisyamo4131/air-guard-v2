/**
 * Table コンポーネント専用のロジック
 * - `SiteOperationScheduleTable` 専用のコンポーザブルです。
 * - 独自に `useDateRange` を使用しています。親コンポーネントで `useDateRange` を使用している場合でも
 *   別インスタンスとして動作することに注意してください。
 */
import * as Vue from "vue";
import { useDateRange } from "@/composables/useDateRange";

export function useTable(props) {
  /**
   * `dateRange` コンポーザブルのセットアップ
   * - `props.startDate` と `props.endDate` を監視して日付範囲を更新します。
   * - `props.holidays` を監視して祝日を設定します。
   */
  const dateRangeComposable = useDateRange();
  const { daysInRangeArray, currentDayCount, dateRange, setHolidays } =
    dateRangeComposable;
  Vue.watchEffect(() => {
    dateRange.value = { from: props.startDate, to: props.endDate };
    setHolidays(props.holidays);
  });

  // セル背景色
  const cellColorClass = Vue.computed(() => ({
    0: props.columnColors[0],
    1: props.columnColors[1],
    2: props.columnColors[2],
    3: props.columnColors[3],
    4: props.columnColors[4],
    5: props.columnColors[5],
    6: props.columnColors[6],
  }));

  /**
   * 引数で与えられたサイズ情報を style に適用できるよう解決して返します。
   * @param {string|number|undefined} size
   * @returns {String|undefined} - 解決されたサイズ文字列または undefined
   */
  const resolveSize = (size) => {
    if (!size) return undefined;
    return typeof size === "number" ? `${size}px` : size;
  };

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

  // 子コンポーネントへの提供
  Vue.provide("props", props);
  Vue.provide("dateRangeComposable", dateRangeComposable);
  Vue.provide("daysInRangeArray", daysInRangeArray);
  Vue.provide("currentDayCount", currentDayCount);
  Vue.provide("cellColorClass", cellColorClass);
  Vue.provide("resolvedColumnWidth", resolvedColumnWidth);
  Vue.provide("resolvedDayHeight", resolvedDayHeight);
  Vue.provide("resolvedWeekdayHeight", resolvedWeekdayHeight);

  return {
    daysInRangeArray,
    currentDayCount,
    cellColorClass,
    resolvedColumnWidth,
    resolvedDayHeight,
    resolvedWeekdayHeight,
  };
}
