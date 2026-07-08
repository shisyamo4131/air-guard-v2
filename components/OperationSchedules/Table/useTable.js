/**
 * Table コンポーネント専用のロジック
 * - `OperationSchedulesTable` 専用のコンポーザブルです。
 */
import * as Vue from "vue";

export function useTable(props) {
  /*****************************************************************************
   * COMPUTED PROPERTIES
   ****************************************************************************/
  // セル背景色
  // インデックスは曜日（0=日曜、1=月曜、...、6=土曜）に対応
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
  Vue.provide("cellColorClass", cellColorClass);
  Vue.provide("resolvedColumnWidth", resolvedColumnWidth);
  Vue.provide("resolvedDayHeight", resolvedDayHeight);
  Vue.provide("resolvedWeekdayHeight", resolvedWeekdayHeight);

  return {
    cellColorClass,
    resolvedColumnWidth,
    resolvedDayHeight,
    resolvedWeekdayHeight,
  };
}
