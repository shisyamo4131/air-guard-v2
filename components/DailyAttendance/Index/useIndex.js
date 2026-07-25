/*****************************************************************************
 * @file ./components/DailyAttendance/Index/useIndex.js
 * @description `DailyAttendanceIndex` 専用 Facade コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDailyAttendancesInRange } from "@/composables/dataLayers/dailyAttendance/useDailyAttendancesInRange";
import { useEmployeesInRange } from "@/composables/dataLayers/employee/useEmployeesInRange";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

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

  /** DATA LAYER COMPOSABLE */
  const { docs, loading: dailyAttendancesLoading } = useDailyAttendancesInRange(
    {
      from: debouncedStartDate,
      to: debouncedEndDate,
      snapshot: true,
    },
  );

  const { docs: employees, loading: employeesLoading } = useEmployeesInRange({
    from: debouncedStartDate,
    to: debouncedEndDate,
    snapshot: true,
  });

  const loadingsStore = useLoadingsStore();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const selectedEmployeeId = Vue.ref(null);
  const loadingsKey = Vue.ref(null);

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const filteredDocs = Vue.computed(() => {
    return docs.value.filter(
      ({ employeeId }) => employeeId === selectedEmployeeId.value,
    );
  });

  /** `DailyAttendances` または `Employees` の読み込み中であるかどうかを示す。 */
  const loading = Vue.computed(() => {
    return dailyAttendancesLoading.value || employeesLoading.value;
  });

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * `loading` が `true` の場合、ロード中のインジケータを表示するために `loadingsStore` に追加します。
   * `loading` が `false` の場合、ロード中のインジケータを削除します。
   */
  Vue.watch(
    loading,
    (newValue) => {
      if (newValue) {
        loadingsKey.value = loadingsStore.add("データを取得しています...");
      } else {
        loadingsStore.remove(loadingsKey.value);
      }
    },
    { immediate: true },
  );

  /**
   * `selectedEmployeeId` が `employees` の中に存在しない場合、`selectedEmployeeId` を `null` にリセットします。
   * - これは、`employees` が更新された際に、選択されている従業員が存在しなくなる可能性があるためです。
   * - 例えば、従業員が退職した場合や、期間外の従業員が選択されている場合などです。
   */
  Vue.watch(employeesLoading, (newValue) => {
    if (newValue) return;
    if (employees.value.some(({ docId }) => docId === selectedEmployeeId.value))
      return;
    selectedEmployeeId.value = null;
  });

  /*****************************************************************************
   * SCOPE DISPOSE
   *****************************************************************************/
  /**
   * `useIndex` がスコープ外になった際に、ロード中のインジケータを削除します。
   * - これは、`useIndex` が使用されているコンポーネントが破棄された場合に、ロード中のインジケータが残らないようにするためです。
   * - 例えば、ユーザーがページを離れた場合や、コンポーネントが非表示になった場合などです。
   */
  Vue.onScopeDispose(() => {
    if (loadingsKey.value) {
      loadingsStore.remove(loadingsKey.value);
      loadingsKey.value = null;
    }
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
        items: employees.value,
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
