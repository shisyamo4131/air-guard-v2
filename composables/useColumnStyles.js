import { computed, unref } from "vue";
import dayjs from "dayjs";
import { DAY_TYPE_HOLIDAY, getDayType } from "air-guard-v2-schemas/constants";

/**
 * 日付カラムのスタイルクラスを計算するコンポーザブル
 * @param {Ref|Date|String|Object} dateAt - 対象日付
 * @returns {Object} 計算されたプロパティとクラス
 */
export function useColumnStyles(dateAt) {
  /** computed values */
  const today = dayjs().startOf("day");
  const targetDay = computed(() => dayjs(unref(dateAt)).locale("en"));

  const dayOfWeek = computed(() => targetDay.value.format("ddd").toLowerCase());

  const dateComparison = computed(() => {
    const target = targetDay.value.startOf("day");
    return {
      isPreviousDay: target.isBefore(today),
      isToday: target.isSame(today),
      isFutureDay: target.isAfter(today),
    };
  });

  const isHoliday = computed(() => {
    return getDayType(targetDay.value.toDate()) === DAY_TYPE_HOLIDAY;
  });

  const dateLabel = computed(() => {
    return targetDay.value.format("MM/DD");
  });

  const cssClasses = computed(() => ({
    "g-col": true,
    [`g-col-${dayOfWeek.value}`]: true,
    "g-col-previous": dateComparison.value.isPreviousDay,
    "g-col-today": dateComparison.value.isToday,
    "g-col-future": dateComparison.value.isFutureDay,
    "g-col-holiday": isHoliday.value,
  }));

  return {
    targetDay,
    dayOfWeek,
    dateComparison,
    isHoliday,
    dateLabel,
    cssClasses,
  };
}

/**
 * 日付プロパティのバリデーター関数
 * @param {any} value - 検証する値
 * @returns {boolean} バリデーション結果
 */
export function validateDateProp(value) {
  return (
    value instanceof Date || typeof value === "string" || dayjs.isDayjs(value)
  );
}
