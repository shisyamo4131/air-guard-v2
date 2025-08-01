import { ref, computed, watch } from "vue";
import dayjs from "dayjs";
import { useDateUtil } from "./useDateUtil";

/**
 * 日付範囲を管理するコンポーザブル
 * @param {Object} options - オプション設定
 * @param {Date} options.baseDate - 基準日（デフォルト: 今日）
 * @param {number} options.dayCount - 表示する日数（デフォルト: 14）
 * @param {number} options.offsetDays - 基準日からのオフセット日数（デフォルト: -1 = 昨日から）
 * @returns {Object} 日付範囲関連の状態と操作
 */
export function useDateRange({
  baseDate = new Date(),
  dayCount = 14,
  offsetDays = -1,
} = {}) {
  /** 日付ユーティリティの取得 */
  const { isValidDate, formatDate, validateDateRange } = useDateUtil();

  /** リアクティブな状態（初期値の検証を追加） */
  const currentBaseDate = ref(isValidDate(baseDate) ? baseDate : new Date());
  const currentDayCount = ref(
    typeof dayCount === "number" && dayCount > 0 ? dayCount : 14
  );
  const currentOffsetDays = ref(
    typeof offsetDays === "number" ? offsetDays : -1
  );

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
   * 日付範囲の文字列表現（useDateUtilを活用）
   */
  const dateRangeLabel = computed(() => {
    const startFormatted = formatDate(startDate.value, "YYYY/MM/DD");
    const endFormatted = formatDate(endDate.value, "YYYY/MM/DD");

    if (!startFormatted || !endFormatted) {
      console.warn("Invalid dates in date range");
      return "Invalid Date Range";
    }

    return `${startFormatted} - ${endFormatted}`;
  });

  /**
   * 日付範囲の有効性をチェック
   */
  const isValidRange = computed(() => {
    return validateDateRange(startDate.value, endDate.value);
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
   * 基準日を変更（検証付き）
   */
  const setBaseDate = (newDate) => {
    if (isValidDate(newDate)) {
      currentBaseDate.value = newDate;
    } else {
      console.warn(
        "Invalid date provided to setBaseDate, keeping current value"
      );
    }
  };

  /**
   * 表示日数を変更（検証付き）
   */
  const setDayCount = (newCount) => {
    if (typeof newCount === "number" && newCount > 0) {
      currentDayCount.value = newCount;
    } else {
      console.warn("Invalid day count provided, keeping current value");
    }
  };

  /**
   * オフセット日数を変更（検証付き）
   */
  const setOffsetDays = (newOffset) => {
    if (typeof newOffset === "number") {
      currentOffsetDays.value = newOffset;
    } else {
      console.warn("Invalid offset provided, keeping current value");
    }
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
    isValidRange,

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
