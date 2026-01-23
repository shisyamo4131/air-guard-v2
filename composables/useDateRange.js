import * as Vue from "vue";
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
 * @return {Object} - 日付範囲コンポーザブルの公開API
 * @return {Ref<Date>} currentBaseDate - 現在の基準日
 * @return {Ref<number>} currentDayCount - 現在の表示日数
 * @return {Ref<number>} currentOffsetDays - 現在のオフセット日数
 * @return {Ref<Date>} startDate - 計算された開始日
 * @return {Ref<Date>} endDate - 計算された終了日
 * @return {Ref<Object>} dateRange - { from: Date, to: Date, dayCount: number }
 * @return {Ref<string>} dateRangeLabel - 日付範囲の文字列表現
 * @return {Ref<boolean>} includesToday - 今日が範囲に含まれるか
 * @return {Ref<boolean>} isValidRange - 日付範囲の有効性
 * @return {Ref<Map<string, Object>>} daysInRangeMap - 範囲内の日付情報マップ
 * @return {Ref<Array>} daysInRangeArray - 範囲内の日付情報配列
 * @return {Function} isHoliday - 指定日が祝日かどうかを判定する関数
 * @return {Ref<Date>} debouncedStartDate - デバウンスされた開始日
 * @return {Ref<Date>} debouncedEndDate - デバウンスされた終了日
 * @return {Ref<Object>} debouncedDateRange - デバウンスされた日付範囲オブジェクト
 * @return {Function} setBaseDate - 基準日を設定する関数
 * @return {Function} setDayCount - 表示日数を設定する関数
 * @return {Function} setEndDate - 終了日を設定する関数
 * @return {Function} setOffsetDays - オフセット日数を設定する関数
 * @return {Function} movePrevious - 日付範囲を前に移動する関数
 * @return {Function} moveNext - 日付範囲を後に移動する関数
 * @return {Function} moveToToday - 今日を含む範囲に移動する関数
 * @return {Function} moveToDate - 指定日を含む範囲に移動する関数
 * @return {Function} flushDebounce - デバウンスを即座に実行する関数
 * @return {Function} move - 日付範囲を指定単位で移動する関数
 */
export function useDateRange({
  baseDate = new Date(),
  dayCount = 14,
  endDate: endDateInput = null, // 引数名を変更
  offsetDays = 0,
  debounceDelay = 500,
} = {}) {
  /** 日付ユーティリティの取得 */
  const { isValidDate, formatDate, validateDateRange, isHoliday } =
    useDateUtil();

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
        return calculatedDays;
      } else {
        console.warn(
          `endDate (${
            endDateInput.toISOString().split("T")[0]
          }) is before baseDate (${
            validBaseDate.toISOString().split("T")[0]
          }), falling back to dayCount`,
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

  /** リアクティブステート */
  const currentBaseDate = Vue.ref(
    isValidDate(baseDate) ? baseDate : new Date(),
  );
  const currentDayCount = Vue.ref(calculateInitialDayCount());
  const currentOffsetDays = Vue.ref(
    typeof offsetDays === "number" ? offsetDays : 0,
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
    debounceDelay,
  );

  // 個別の値変更を監視して統合オブジェクトを更新
  Vue.watch(
    [currentBaseDate, currentDayCount, currentOffsetDays],
    ([newBaseDate, newDayCount, newOffsetDays]) => {
      debouncedConfig.value.value = {
        baseDate: newBaseDate,
        dayCount: newDayCount,
        offsetDays: newOffsetDays,
      };
    },
  );

  /**
   * 開始日を計算（基準日 + オフセット）
   */
  const startDate = Vue.computed(() => {
    return dayjs(currentBaseDate.value)
      .add(currentOffsetDays.value, "day")
      .startOf("day")
      .toDate();
  });

  /**
   * 終了日を計算（開始日 + 表示日数 - 1）
   */
  const endDate = Vue.computed(() => {
    return dayjs(startDate.value)
      .add(currentDayCount.value - 1, "day")
      .endOf("day")
      .toDate();
  });

  /**
   * デバウンスされた開始日
   */
  const debouncedStartDate = Vue.computed(() => {
    const config = debouncedConfig.debouncedValue.value;
    return dayjs(config.baseDate)
      .add(config.offsetDays, "day")
      .startOf("day")
      .toDate();
  });

  /**
   * デバウンスされた終了日
   */
  const debouncedEndDate = Vue.computed(() => {
    const config = debouncedConfig.debouncedValue.value;
    return dayjs(debouncedStartDate.value)
      .add(config.dayCount - 1, "day")
      .endOf("day")
      .toDate();
  });

  const dateRange = Vue.computed({
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
  const debouncedDateRange = Vue.computed(() => {
    return {
      from: debouncedStartDate.value,
      to: debouncedEndDate.value,
      dayCount: debouncedConfig.debouncedValue.value.dayCount,
    };
  });

  /**
   * 日付範囲の文字列表現
   */
  const dateRangeLabel = Vue.computed(() => {
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
  const isValidRange = Vue.computed(() => {
    return validateDateRange(startDate.value, endDate.value);
  });

  /**
   * 今日が表示範囲に含まれているかどうか
   */
  const includesToday = Vue.computed(() => {
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
        "Invalid date provided to setBaseDate, keeping current value",
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
   * 日付範囲を変更します。
   * - `unit` が "range" の場合、`value` は日数として扱われ、基準日をその日数分だけ移動します。
   * - `unit` が "month" の場合、`value` は月数として扱われ、基準日をその月数分だけ移動し、範囲をその月の初日から末日に設定します。
   * @param {{value: number, unit?: string}} options - 移動オプション
   * @param {number} options.value - 移動する日数または月数
   * @param {string} [options.unit="range"] - "range" または "month"
   */
  const move = ({ value, unit = "range" }) => {
    if (unit === "range") {
      currentBaseDate.value = dayjs(currentBaseDate.value)
        .add(value, "day")
        .toDate();
    } else if (unit === "month") {
      setBaseDate(
        dayjs(currentBaseDate.value)
          .add(value, "month")
          .startOf("month")
          .toDate(),
      );
      setEndDate(dayjs(currentBaseDate.value).endOf("month").toDate());
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

  /**
   * 範囲内の日付について日付文字列（YYYY-MM-DD）をキーとし、
   * その日付に関する詳細情報を含めたオブジェクトを値とするマップを返す。
   * NOTE: `isHoliday` は `setHolidays` で設定された祝日情報に基づく。
   * @return {Map<string, Object>} daysInRangeMap - 日付情報マップ
   * @return {string} return.date - 日付文字列（YYYY-MM-DD）
   * @return {Date} return.dateAt - Dateオブジェクト
   * @return {string} return.weekday - 曜日文字列（例: "Mon"）
   * @return {Function} return.format - 指定フォーマットで日付を返す関数
   * @return {boolean} return.isToday - 今日かどうか
   * @return {boolean} return.isPreviousDay - 過去日かどうか
   * @return {boolean} return.isFuture - 未来日かどうか
   * @return {boolean} return.isHoliday - 祝日かどうか
   */
  const daysInRangeMap = Vue.computed(() => {
    const map = new Map();
    for (let i = 0; i < currentDayCount.value; i++) {
      const dateAt = dayjs(startDate.value).add(i, "day").toDate();
      const dateKey = formatDate(dateAt, "YYYY-MM-DD");
      map.set(dateKey, {
        date: formatDate(dateAt, "YYYY-MM-DD"),
        dateAt,
        weekday: formatDate(dateAt, "ddd"),
        format: (format) => formatDate(dateAt, format),
        isToday:
          formatDate(dateAt, "YYYY-MM-DD") ===
          formatDate(new Date(), "YYYY-MM-DD"),
        isPreviousDay: dateAt < dayjs().startOf("day").toDate(),
        isFuture: dateAt > dayjs().startOf("day").toDate(),
        isHoliday: isHoliday(dateAt),
      });
    }
    return map;
  });

  const daysInRangeArray = Vue.computed(() => {
    return Array.from(daysInRangeMap.value.values());
  });

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
    daysInRangeMap, // 2026-01-15 追加
    daysInRangeArray, // 2026-01-15 追加

    isHoliday, // 2026-01-23 追加（useDateUtilから取得）

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
    move, // 2026-01-20 追加
  };
}
