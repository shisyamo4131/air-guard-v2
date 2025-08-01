import { ref, computed, watch } from "vue";
import dayjs from "dayjs";

/**
 * スケジュール表示の日付範囲を管理するコンポーザブル
 * @param {Object} options - オプション設定
 * @param {Date} options.baseDate - 基準日（デフォルト: 今日）
 * @param {number} options.dayCount - 表示する日数（デフォルト: 14）
 * @param {number} options.offsetDays - 基準日からのオフセット日数（デフォルト: -1 = 昨日から）
 * @returns {Object} 日付範囲関連の状態と操作
 */
export function useScheduleDateRange({
  baseDate = new Date(),
  dayCount = 14,
  offsetDays = -1,
} = {}) {
  /** リアクティブな状態 */
  const currentBaseDate = ref(baseDate);
  const currentDayCount = ref(dayCount);
  const currentOffsetDays = ref(offsetDays);

  /**
   * 開始日を計算（基準日 + オフセット）
   */
  const startDate = computed(() => {
    return dayjs(currentBaseDate.value)
      .add(currentOffsetDays.value, "day")
      .startOf("day")
      .toDate();
  });

  /**
   * 終了日を計算（開始日 + 表示日数 - 1）
   */
  const endDate = computed(() => {
    return dayjs(startDate.value)
      .add(currentDayCount.value - 1, "day")
      .endOf("day")
      .toDate();
  });

  /**
   * 日付範囲オブジェクト
   */
  const dateRange = computed(() => ({
    from: startDate.value,
    to: endDate.value,
    dayCount: currentDayCount.value,
  }));

  /**
   * 日付範囲の文字列表現
   */
  const dateRangeLabel = computed(() => {
    const start = dayjs(startDate.value);
    const end = dayjs(endDate.value);
    return `${start.format("YYYY/MM/DD")} - ${end.format("YYYY/MM/DD")}`;
  });

  /**
   * 今日が表示範囲に含まれているかどうか
   */
  const includesToday = computed(() => {
    const today = dayjs().startOf("day");
    const start = dayjs(startDate.value).startOf("day");
    const end = dayjs(endDate.value).startOf("day");

    return today.isSameOrAfter(start) && today.isSameOrBefore(end);
  });

  /**
   * 基準日を変更
   */
  const setBaseDate = (newDate) => {
    currentBaseDate.value = newDate;
  };

  /**
   * 表示日数を変更
   */
  const setDayCount = (newCount) => {
    currentDayCount.value = newCount;
  };

  /**
   * オフセット日数を変更
   */
  const setOffsetDays = (newOffset) => {
    currentOffsetDays.value = newOffset;
  };

  /**
   * 日付範囲を前に移動
   */
  const movePrevious = (days = currentDayCount.value) => {
    currentBaseDate.value = dayjs(currentBaseDate.value)
      .subtract(days, "day")
      .toDate();
  };

  /**
   * 日付範囲を後に移動
   */
  const moveNext = (days = currentDayCount.value) => {
    currentBaseDate.value = dayjs(currentBaseDate.value)
      .add(days, "day")
      .toDate();
  };

  /**
   * 今日を含む範囲に移動
   */
  const moveToToday = () => {
    currentBaseDate.value = new Date();
  };

  /**
   * 指定された日付を含む範囲に移動
   */
  const moveToDate = (targetDate) => {
    // 指定日が範囲の中央付近になるように基準日を調整
    const halfDays = Math.floor(currentDayCount.value / 2);
    currentBaseDate.value = dayjs(targetDate)
      .subtract(halfDays - currentOffsetDays.value, "day")
      .toDate();
  };

  return {
    // 状態
    currentBaseDate,
    currentDayCount,
    currentOffsetDays,
    startDate,
    endDate,
    dateRange,
    dateRangeLabel,
    includesToday,

    // 操作
    setBaseDate,
    setDayCount,
    setOffsetDays,
    movePrevious,
    moveNext,
    moveToToday,
    moveToDate,
  };
}
