import { ref, computed, watch } from "vue";
import dayjs from "dayjs";
import { useDateUtil } from "./useDateUtil";
import { useDebouncedRef } from "./usePerformanceOptimization";

/**
 * 日付範囲を管理するコンポーザブル
 * @param {Object} options - オプション設定
 * @param {Date} options.baseDate - 基準日（デフォルト: 今日）
 * @param {number} options.dayCount - 表示する日数（デフォルト: 14）※endDate指定時は無視
 * @param {Date} options.endDate - 終了日（指定時はdayCountより優先）
 * @param {number} options.offsetDays - 基準日からのオフセット日数（デフォルト: 0）
 * @param {number} options.debounceDelay - デバウンス遅延時間（ミリ秒、デフォルト: 500）
 * @returns {Object} 日付範囲関連の状態と操作
 */
export function useDateRange({
  baseDate = new Date(),
  dayCount = 14,
  endDate: endDateInput = null, // 引数名を変更
  offsetDays = 0,
  debounceDelay = 500,
} = {}) {
  /** 日付ユーティリティの取得 */
  const { isValidDate, formatDate, validateDateRange } = useDateUtil();

  /**
   * 初期日数を計算
   * 優先順位: endDate > dayCount > デフォルト(14)
   */
  const calculateInitialDayCount = () => {
    const validBaseDate = isValidDate(baseDate) ? baseDate : new Date();

    // 1. endDateが指定されていれば最優先
    if (endDateInput && isValidDate(endDateInput)) {
      const calculatedDays =
        dayjs(endDateInput).diff(dayjs(validBaseDate), "day") + 1;
      if (calculatedDays > 0) {
        // if (
        //   typeof dayCount === "number" &&
        //   dayCount > 0 &&
        //   dayCount !== calculatedDays
        // ) {
        //   console.info(
        //     `endDate specified: calculated ${calculatedDays} days (dayCount: ${dayCount} ignored)`
        //   );
        // }
        return calculatedDays;
      } else {
        console.warn(
          `endDate (${
            endDateInput.toISOString().split("T")[0]
          }) is before baseDate (${
            validBaseDate.toISOString().split("T")[0]
          }), falling back to dayCount`
        );
      }
    }

    // 2. dayCountが有効な数値であればそれを使用
    if (typeof dayCount === "number" && dayCount > 0) {
      return dayCount;
    }

    // 3. デフォルト値
    console.warn("Invalid dayCount provided, using default value (14)");
    return 14;
  };

  /** リアクティブな状態（初期値の検証を追加） */
  const currentBaseDate = ref(isValidDate(baseDate) ? baseDate : new Date());
  const currentDayCount = ref(calculateInitialDayCount());
  const currentOffsetDays = ref(
    typeof offsetDays === "number" ? offsetDays : 0
  );

  /**
   * 単一のデバウンス設定オブジェクト
   * - 複数の値変更を1回のデバウンスにまとめる
   */
  const debouncedConfig = useDebouncedRef(
    {
      baseDate: currentBaseDate.value,
      dayCount: currentDayCount.value,
      offsetDays: currentOffsetDays.value,
    },
    debounceDelay
  );

  // 個別の値変更を監視して統合オブジェクトを更新
  watch(
    [currentBaseDate, currentDayCount, currentOffsetDays],
    ([newBaseDate, newDayCount, newOffsetDays]) => {
      debouncedConfig.value.value = {
        baseDate: newBaseDate,
        dayCount: newDayCount,
        offsetDays: newOffsetDays,
      };
    }
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
   * デバウンスされた開始日
   */
  const debouncedStartDate = computed(() => {
    const config = debouncedConfig.debouncedValue.value;
    return dayjs(config.baseDate)
      .add(config.offsetDays, "day")
      .startOf("day")
      .toDate();
  });

  /**
   * デバウンスされた終了日
   */
  const debouncedEndDate = computed(() => {
    const config = debouncedConfig.debouncedValue.value;
    return dayjs(debouncedStartDate.value)
      .add(config.dayCount - 1, "day")
      .endOf("day")
      .toDate();
  });

  const dateRange = computed({
    get: () => {
      return {
        from: startDate.value,
        to: endDate.value,
        dayCount: currentDayCount.value,
      };
    },
    set: ({ from, to }) => {
      if (from) setBaseDate(from);
      if (to) {
        if (typeof to === "number") {
          setDayCount(to);
        } else if (to instanceof Date) {
          const dayCount = dayjs(to).diff(dayjs(startDate.value), "day");
          setDayCount(dayCount + 1);
        }
      }
    },
  });

  /**
   * デバウンスされた日付範囲
   */
  const debouncedDateRange = computed(() => {
    return {
      from: debouncedStartDate.value,
      to: debouncedEndDate.value,
      dayCount: debouncedConfig.debouncedValue.value.dayCount,
    };
  });

  /**
   * 日付範囲の文字列表現
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
   * デバウンスを即座に実行（強制実行）
   */
  const flushDebounce = () => {
    debouncedConfig.immediate({
      baseDate: currentBaseDate.value,
      dayCount: currentDayCount.value,
      offsetDays: currentOffsetDays.value,
    });
  };

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
   * 終了日を設定して日数を自動計算（新規追加）
   */
  const setEndDate = (newEndDate) => {
    if (isValidDate(newEndDate)) {
      const calculatedDayCount =
        dayjs(newEndDate).diff(dayjs(currentBaseDate.value), "day") + 1;
      if (calculatedDayCount > 0) {
        currentDayCount.value = calculatedDayCount;
      } else {
        console.warn("End date must be after base date");
      }
    } else {
      console.warn("Invalid end date provided to setEndDate");
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
    // 状態（即座更新）
    currentBaseDate,
    currentDayCount,
    currentOffsetDays,
    startDate,
    endDate,
    dateRange,
    dateRangeLabel,
    includesToday,
    isValidRange,

    // デバウンス状態
    debouncedStartDate,
    debouncedEndDate,
    debouncedDateRange,

    // 操作
    setBaseDate,
    setDayCount,
    setOffsetDays,
    setEndDate, // 新規追加
    movePrevious,
    moveNext,
    moveToToday,
    moveToDate,
    flushDebounce,
  };
}
