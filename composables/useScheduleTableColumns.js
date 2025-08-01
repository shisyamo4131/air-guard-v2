import { computed, unref } from "vue";
import dayjs from "dayjs";
import { useColumnStyles } from "./useColumnStyles";

/**
 * スケジュールテーブルの列を管理するコンポーザブル
 * @param {Object} options - オプション設定
 * @param {number|Ref} options.dayCount - 表示する日数
 * @param {Date|Ref} options.startDate - 開始日
 * @param {Array|Ref} options.schedules - スケジュールデータ（稼働数計算用）
 * @returns {Object} 列関連の計算されたプロパティ
 */
export function useScheduleTableColumns({
  dayCount = 7,
  startDate = null,
  schedules = null,
} = {}) {
  /**
   * テーブルの列データを生成
   */
  const columns = computed(() => {
    const resolvedDayCount = unref(dayCount);
    const resolvedStartDate = unref(startDate);
    const resolvedSchedules = unref(schedules) || [];

    const baseDate = resolvedStartDate
      ? dayjs(resolvedStartDate).startOf("day")
      : dayjs().startOf("day").subtract(1, "day");

    const result = [];

    for (let i = 0; i < resolvedDayCount; i++) {
      const date = baseDate.add(i, "day");
      const dateAt = date.toDate();

      // useColumnStyles を各列で使用
      const columnStyles = useColumnStyles(dateAt);

      // その日の稼働数を計算
      const requiredPersonnelTotal = resolvedSchedules
        .filter((schedule) => {
          if (!schedule?.date) return false;
          return dayjs(schedule.date).isSame(date, "day");
        })
        .reduce((total, schedule) => {
          const required = schedule?.requiredPersonnel || 0;
          return total + (typeof required === "number" ? required : 0);
        }, 0);

      result.push({
        date: date.format("YYYY-MM-DD"),
        dateAt,
        requiredPersonnelTotal, // 稼働数を追加
        // スタイル関連の情報を追加
        ...columnStyles,
      });
    }

    return result;
  });

  /**
   * 今日の列のインデックスを取得
   */
  const todayColumnIndex = computed(() => {
    const today = dayjs().startOf("day");
    return columns.value.findIndex((column) =>
      dayjs(column.dateAt).isSame(today, "day")
    );
  });

  /**
   * 指定された日付の列を取得
   */
  const getColumnByDate = (targetDate) => {
    const target = dayjs(targetDate).startOf("day");
    return columns.value.find((column) =>
      dayjs(column.dateAt).isSame(target, "day")
    );
  };

  return {
    columns,
    todayColumnIndex,
    getColumnByDate,
  };
}
