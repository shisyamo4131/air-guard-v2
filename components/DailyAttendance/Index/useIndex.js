/*****************************************************************************
 * @file ./components/DailyAttendance/Index/useIndex.js
 * @description `DailyAttendanceIndex` 専用 Facade コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDailyAttendanceIndexData } from "@/composables/application/dailyAttendance/useDailyAttendanceIndexData";
import { useDailyAttendanceStatistics } from "@/composables/transforms/useDailyAttendanceStatistics";

export function useIndex() {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  /** DATE RANGE COMPOSABLE */
  const baseDate = dayjs().tz().startOf("month").toDate();
  const endDate = dayjs().tz().endOf("month").toDate();
  const { dateRange, debouncedStartDate, debouncedEndDate } = useDateRange({
    baseDate,
    endDate,
  });

  const { dailyAttendances, employees, loading } = useDailyAttendanceIndexData({
    from: debouncedStartDate,
    to: debouncedEndDate,
  });

  const statistics = useDailyAttendanceStatistics(dailyAttendances);

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const selectedEmployeeId = Vue.ref(null);

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * `selectedEmployeeId` が `employees` の中に存在しない場合、`selectedEmployeeId` を `null` にリセットします。
   * - これは、`employees` が更新された際に、選択されている従業員が存在しなくなる可能性があるためです。
   * - 例えば、従業員が退職した場合や、期間外の従業員が選択されている場合などです。
   */
  Vue.watch(loading, (newValue) => {
    if (newValue) return;
    if (employees.value.some(({ docId }) => docId === selectedEmployeeId.value))
      return;
    selectedEmployeeId.value = null;
  });

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const filteredDocs = Vue.computed(() => {
    return dailyAttendances.value.filter(
      ({ employeeId }) => employeeId === selectedEmployeeId.value,
    );
  });

  const filteredStatistics = Vue.computed(() => {
    if (!selectedEmployeeId.value) return null;
    return statistics.value.get(selectedEmployeeId.value) ?? null;
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    ui: Vue.computed(() => ({
      toolbar: {
        color: "secondary",
        density: "compact",
        flat: true,
      },
      employeeSelect: {
        modelValue: selectedEmployeeId.value,
        "onUpdate:model-value": (value) => (selectedEmployeeId.value = value),
        flat: true,
        hideDetails: true,
        items: employees.value,
        variant: "solo",
      },
      employeesList: {
        color: "primary",
        density: "compact",
        items: employees.value.map((employee) => {
          return {
            ...employee,
            props: {
              subtitle: employee.code,
            },
          };
        }),
        itemTitle: "fullName",
        itemValue: "docId",
        selected: selectedEmployeeId.value ? [selectedEmployeeId.value] : [],
        width: 240,
        "onUpdate:selected": (value) =>
          (selectedEmployeeId.value = value[0] || null),
      },
      monthSelector: {
        modelValue: dateRange.value.from,
        onDateRange: (value) => (dateRange.value = value),
      },
      calendar: {
        docs: filteredDocs.value,
        modelValue: dateRange.value.from,
      },
    })),
    statistics: filteredStatistics,
  };
}
