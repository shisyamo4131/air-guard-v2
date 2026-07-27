/*****************************************************************************
 * @file ./composables/transforms/useDailyAttendanceStatistics.js
 * @description DailyAttendanceドキュメントの配列から、従業員別の勤怠統計Mapを生成します。
 *****************************************************************************/
import * as Vue from "vue";

/**
 * 空の勤務区分別統計を生成します。
 * @returns {{
 *   attendanceCount: number,
 *   detailCount: number,
 *   totalWorkMinutes: number,
 *   totalBreakMinutes: number
 * }}
 */
function createEmptyShiftTypeStatistics() {
  return {
    // 当該勤務区分の稼働明細が1件以上存在する勤務日数。
    // 同一勤務日に同じ勤務区分の明細が複数あっても1日として数えます。
    attendanceCount: 0,

    // 当該勤務区分に属する稼働明細の総数。
    // 同一勤務日に同じ勤務区分の明細が2件あれば2件として数えます。
    detailCount: 0,

    // 当該勤務区分に属する全明細の実労働時間の合計（分）。
    // 各明細のtotalWorkMinutesを合計するため、休憩時間は含みません。
    totalWorkMinutes: 0,

    // 当該勤務区分に属する全明細の休憩時間の合計（分）。
    totalBreakMinutes: 0,
  };
}

/**
 * 空の従業員別統計を生成します。
 * @returns {{
 *   attendanceCount: number,
 *   detailCount: number,
 *   totalWorkMinutes: number,
 *   totalBreakMinutes: number,
 *   exportableAttendanceCount: number,
 *   unexportableAttendanceCount: number,
 *   byShiftType: Map<string, ReturnType<typeof createEmptyShiftTypeStatistics>>
 * }}
 */
function createEmptyEmployeeStatistics() {
  return {
    // 当該従業員に稼働実績が存在する勤務日数。
    // DailyAttendance.isAttendedがtrueのドキュメントを1日として数えます。
    attendanceCount: 0,

    // 当該従業員に紐づく全稼働明細の総数。
    // 同一勤務日に複数の稼働明細があれば、その件数分を数えます。
    detailCount: 0,

    // 当該従業員の全稼働明細における実労働時間の合計（分）。
    // 各明細のtotalWorkMinutesを合計するため、休憩時間は含みません。
    totalWorkMinutes: 0,

    // 当該従業員の全稼働明細における休憩時間の合計（分）。
    totalBreakMinutes: 0,

    // DailyAttendance.isExportableがtrueのドキュメント数。
    exportableAttendanceCount: 0,

    // DailyAttendance.isExportableがfalseのドキュメント数。
    unexportableAttendanceCount: 0,

    // 勤務区分をキーとし、勤務区分別の統計情報を値とするMap。
    byShiftType: new Map(),
  };
}

/**
 * 有限な数値を返します。数値として扱えない場合は0を返します。
 * @param {*} value
 * @returns {number}
 */
function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * DailyAttendanceドキュメントの配列から、employeeIdをキーとした勤怠統計Mapを生成します。
 *
 * `attendanceCount`は勤務日数、`detailCount`は稼働明細数を表します。
 * 同一勤務日に同じ勤務区分の明細が複数ある場合、勤務区分別の
 * `attendanceCount`は1、`detailCount`は明細数分加算されます。
 *
 * @param {import("vue").MaybeRefOrGetter<Array>} dailyAttendances
 * @returns {import("vue").ComputedRef<Map<string, {
 *   attendanceCount: number,
 *   detailCount: number,
 *   totalWorkMinutes: number,
 *   totalBreakMinutes: number,
 *   exportableAttendanceCount: number,
 *   unexportableAttendanceCount: number,
 *   byShiftType: Map<string, {
 *     attendanceCount: number,
 *     detailCount: number,
 *     totalWorkMinutes: number,
 *     totalBreakMinutes: number
 *   }>
 * }>>}
 */
export function useDailyAttendanceStatistics(dailyAttendances) {
  return Vue.computed(() => {
    const source = Vue.toValue(dailyAttendances) ?? [];
    const statisticsMap = new Map();

    for (const dailyAttendance of source) {
      const employeeId = dailyAttendance.employeeId;

      if (!statisticsMap.has(employeeId)) {
        statisticsMap.set(employeeId, createEmptyEmployeeStatistics());
      }

      const employeeStatistics = statisticsMap.get(employeeId);
      const details = dailyAttendance.details ?? [];
      const attendedShiftTypes = new Set();

      if (dailyAttendance.isAttended) {
        employeeStatistics.attendanceCount += 1;
      }

      if (dailyAttendance.isExportable) {
        employeeStatistics.exportableAttendanceCount += 1;
      } else {
        employeeStatistics.unexportableAttendanceCount += 1;
      }

      for (const detail of details) {
        const shiftType = detail.shiftType;
        const totalWorkMinutes = toFiniteNumber(detail.totalWorkMinutes);
        const breakMinutes = toFiniteNumber(detail.breakMinutes);

        if (!employeeStatistics.byShiftType.has(shiftType)) {
          employeeStatistics.byShiftType.set(
            shiftType,
            createEmptyShiftTypeStatistics(),
          );
        }

        const shiftTypeStatistics =
          employeeStatistics.byShiftType.get(shiftType);

        employeeStatistics.detailCount += 1;
        employeeStatistics.totalWorkMinutes += totalWorkMinutes;
        employeeStatistics.totalBreakMinutes += breakMinutes;

        shiftTypeStatistics.detailCount += 1;
        shiftTypeStatistics.totalWorkMinutes += totalWorkMinutes;
        shiftTypeStatistics.totalBreakMinutes += breakMinutes;
        attendedShiftTypes.add(shiftType);
      }

      for (const shiftType of attendedShiftTypes) {
        employeeStatistics.byShiftType.get(shiftType).attendanceCount += 1;
      }
    }

    return statisticsMap;
  });
}
