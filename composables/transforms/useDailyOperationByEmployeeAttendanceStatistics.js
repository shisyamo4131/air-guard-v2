/*****************************************************************************
 * @file composables/transforms/useDailyOperationByEmployeeAttendanceStatistics.js
 * @description DailyOperationByEmployeeから勤怠表示用の従業員別統計を生成します。
 *****************************************************************************/
import * as Vue from "vue";

function createEmptyShiftTypeStatistics() {
  return {
    attendanceCount: 0,
    detailCount: 0,
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
  };
}

function createEmptyEmployeeStatistics() {
  return {
    attendanceCount: 0,
    detailCount: 0,
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
    byShiftType: new Map(),
  };
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * @param {import("vue").MaybeRefOrGetter<Array>} dailyOperationsByEmployee
 * @returns {import("vue").ComputedRef<Map<string, Object>>}
 */
export function useDailyOperationByEmployeeAttendanceStatistics(
  dailyOperationsByEmployee,
) {
  return Vue.computed(() => {
    const source = Vue.toValue(dailyOperationsByEmployee) ?? [];
    const statisticsMap = new Map();

    for (const dailyOperation of source) {
      const employeeId = dailyOperation.employeeId;

      if (!statisticsMap.has(employeeId)) {
        statisticsMap.set(employeeId, createEmptyEmployeeStatistics());
      }

      const employeeStatistics = statisticsMap.get(employeeId);
      const details = dailyOperation.details ?? [];
      const attendedShiftTypes = new Set();

      if (details.length > 0) {
        employeeStatistics.attendanceCount += 1;
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
