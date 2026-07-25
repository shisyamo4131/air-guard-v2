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
  const { fetchEmployeeComposable } = useFetch("DailyAttendanceIndex");
  const { cachedEmployeesArray } = fetchEmployeeComposable;
  const baseDate = dayjs().tz("Asia/Tokyo").startOf("month").toDate();
  const endDate = dayjs().tz("Asia/Tokyo").endOf("month").toDate();
  const {
    dateRange,
    startDate,
    endDate: rangeEndDate,
  } = useDateRange({ baseDate, endDate });
  const { docs } = useDailyAttendancesInRange({
    from: startDate,
    to: rangeEndDate,
  });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const selectedEmployeeId = ref(null);

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const filteredDocs = computed(() => {
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
