import { computed, watch, provide } from "vue";
import { useDateRange } from "@/composables/useDateRange";

/**
 * Table コンポーネント専用のロジック
 */
export function useTable(props) {
  // 日付範囲の管理
  const dateRangeComposable = useDateRange({
    baseDate: new Date(props.startDate),
    endDate: new Date(props.endDate),
  });
  const { daysInRangeArray, currentDayCount } = dateRangeComposable;

  // 祝日の監視
  watch(
    () => props.holidays,
    (newHolidays) => {
      dateRangeComposable.setHolidays(newHolidays);
    },
    { immediate: true, deep: true },
  );

  // セル背景色
  const cellColorClass = computed(() => ({
    0: props.columnColors[0],
    1: props.columnColors[1],
    2: props.columnColors[2],
    3: props.columnColors[3],
    4: props.columnColors[4],
    5: props.columnColors[5],
    6: props.columnColors[6],
  }));

  // 列幅
  const resolvedColumnWidth = computed(() => {
    if (!props.columnWidth) return undefined;
    return typeof props.columnWidth === "number"
      ? `${props.columnWidth}px`
      : props.columnWidth;
  });

  /**
   * 高さの値を解決して返します。
   */
  const resolveHeight = (height) => {
    if (!height) return undefined;
    return typeof height === "number" ? `${height}px` : height;
  };

  /**
   * 日付セルの高さを解決して返します。
   */
  const resolvedDayHeight = computed(() => {
    if (!props.dayHeight) return undefined;
    return resolveHeight(props.dayHeight);
  });

  /**
   * 曜日セルの高さを解決して返します。
   */
  const resolvedWeekdayHeight = computed(() => {
    if (!props.weekdayHeight) return undefined;
    return resolveHeight(props.weekdayHeight);
  });

  // 子コンポーネントへの提供
  provide("props", props);
  provide("daysInRangeArray", daysInRangeArray);
  provide("currentDayCount", currentDayCount);
  provide("cellColorClass", cellColorClass);
  provide("resolvedColumnWidth", resolvedColumnWidth);
  provide("resolvedDayHeight", resolvedDayHeight);
  provide("resolvedWeekdayHeight", resolvedWeekdayHeight);

  return {
    daysInRangeArray,
    currentDayCount,
    cellColorClass,
    resolvedColumnWidth,
    resolvedDayHeight,
    resolvedWeekdayHeight,
  };
}
