/*****************************************************************************
 * @file components/DailyAttendance/Exporter/useIndex.js
 * @description DailyAttendanceExporter専用Facadeコンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDailyAttendancesInRange } from "@/composables/dataLayers/dailyAttendance/useDailyAttendancesInRange";
import { useFetch } from "@/composables/fetch/useFetch";
import {
  ATTENDANCE_PUNCH_TYPE,
  createAttendancePunchRows,
} from "@/utils/attendance/createAttendancePunchRows";
import { exportAttendancePunchesCsv } from "@/utils/csv/exportAttendancePunchesCsv";

const PUNCH_TYPE_LABELS = Object.freeze({
  [ATTENDANCE_PUNCH_TYPE.CLOCK_IN]: "出勤",
  [ATTENDANCE_PUNCH_TYPE.CLOCK_OUT]: "退勤",
  [ATTENDANCE_PUNCH_TYPE.BREAK_START]: "休憩開始",
  [ATTENDANCE_PUNCH_TYPE.BREAK_END]: "休憩終了",
});

export function useIndex() {
  const { fetchEmployeeComposable } = useFetch("DailyAttendanceExporter");
  const {
    fetchEmployee,
    cachedEmployees,
    isLoading: loadingEmployees,
  } = fetchEmployeeComposable;
  const baseDate = dayjs().startOf("month").toDate();
  const endDate = dayjs().endOf("month").toDate();
  const { dateRange, debouncedStartDate, debouncedEndDate } = useDateRange({
    baseDate,
    endDate,
  });
  const { docs } = useDailyAttendancesInRange({
    from: debouncedStartDate,
    to: debouncedEndDate,
    snapshot: true,
  });

  Vue.watch(
    () => docs.value.map(({ employeeId }) => employeeId),
    (employeeIds) => fetchEmployee(employeeIds),
    { immediate: true },
  );

  const exportResult = Vue.computed(() =>
    createAttendancePunchRows({
      dailyAttendances: docs.value,
      employeesById: cachedEmployees.value,
    }),
  );

  const previewItems = Vue.computed(() =>
    exportResult.value.rows.map((row, index) => ({
      id: `${row.employeeCode}-${row.punchDateTime}-${row.punchTypeCode}-${index}`,
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      punchType: PUNCH_TYPE_LABELS[row.punchTypeCode] ?? row.punchTypeCode,
      punchDateTime: row.punchDateTime,
    })),
  );

  const rejectedItems = Vue.computed(() =>
    exportResult.value.rejected.map(({ attendance, employee, messages }) => ({
      id: attendance.docId,
      date: attendance.date,
      employeeCode: employee?.code ?? "",
      employeeName: employee?.fullName ?? employee?.displayName ?? "",
      messages: messages.join(" / "),
    })),
  );

  const exportableAttendanceCount = Vue.computed(
    () => docs.value.length - exportResult.value.rejected.length,
  );

  function onClickExport() {
    exportAttendancePunchesCsv({
      rows: exportResult.value.rows,
      from: debouncedStartDate.value,
      to: debouncedEndDate.value,
    });
  }

  return {
    ui: Vue.computed(() => ({
      monthSelector: {
        modelValue: dateRange.value.from,
        onDateRange: (value) => (dateRange.value = value),
      },
      exportButton: {
        disabled:
          loadingEmployees.value || exportResult.value.rows.length === 0,
        loading: loadingEmployees.value,
        onClick: onClickExport,
      },
    })),
    docs,
    previewItems,
    rejectedItems,
    exportableAttendanceCount,
  };
}
