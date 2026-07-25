/*****************************************************************************
 * @file ./components/DailyAttendance/Index/useIndex.js
 * @description `DailyAttendanceIndex` 専用 Facade コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDailyAttendancesInRange } from "@/composables/dataLayers/dailyAttendance/useDailyAttendancesInRange";
import { useFetch } from "@/composables/fetch/useFetch";

export function useIndex() {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  /** FETCH COMPOSABLE */
  const { fetchEmployeeComposable } = useFetch("DailyAttendanceIndex");
  const { fetchEmployee, cachedEmployeesArray } = fetchEmployeeComposable;

  /** DATE RANGE COMPOSABLE */
  const baseDate = dayjs().tz().startOf("month").toDate();
  const endDate = dayjs().tz().endOf("month").toDate();
  const { dateRange, debouncedStartDate, debouncedEndDate } = useDateRange({
    baseDate,
    endDate,
  });

  /** DATA LAYER COMPOSABLE */
  const { docs } = useDailyAttendancesInRange({
    from: debouncedStartDate,
    to: debouncedEndDate,
    snapshot: true,
  });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const selectedEmployeeId = Vue.ref(null);

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(
    () => docs.value.map(({ employeeId }) => employeeId),
    (employeeIds) => fetchEmployee(employeeIds),
    { immediate: true },
  );

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const filteredDocs = Vue.computed(() => {
    return docs.value.filter(
      ({ employeeId }) => employeeId === selectedEmployeeId.value,
    );
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    ui: Vue.computed(() => ({
      toolbar: {
        color: "secondary",
        density: "comfortable",
        flat: true,
      },
      employeeSelect: {
        modelValue: selectedEmployeeId.value,
        "onUpdate:model-value": (value) => (selectedEmployeeId.value = value),
        flat: true,
        hideDetails: true,
        items: cachedEmployeesArray.value,
        width: 320,
        variant: "solo",
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
  };
}
