/*****************************************************************************
 * @file ./composables/application/dailyAttendance/useDailyAttendanceIndexData.js
 * @description 期間内の DailyAttendance ドキュメント群 および 期間内に在職している従業員ドキュメントの配列を提供します。
 * - データ取得中はローディングインジケータを表示します。
 *****************************************************************************/
import * as Vue from "vue";
import { useDailyAttendancesInRange } from "@/composables/dataLayers/dailyAttendance/useDailyAttendancesInRange";
import { useEmployeesInRange } from "@/composables/dataLayers/employee/useEmployeesInRange";
import { rangeIsRef } from "@/composables/validators/rangeValidator";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { Employee, DailyAttendance } from "@/schemas";

/**
 * @param {{ from: import('vue').Ref<Date>, to: import('vue').Ref<Date> }} options
 * @returns {{
 *  dailyAttendances: import('vue').ComputedRef<Array<DailyAttendance>>,
 *  employees: import('vue').ComputedRef<Array<Employee>>,
 *  loading: import('vue').ComputedRef<boolean>
 * }}
 */
export function useDailyAttendanceIndexData({ from, to } = {}) {
  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  /** Validate `from` and `to` are Ref<Date>. */
  rangeIsRef({ from, to });

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  /** LOADINGS STORE */
  const loadingsStore = useLoadingsStore();

  /** DAILY ATTENDANCES DATA LAYER */
  const { docs: dailyAttendances, loading: dailyAttendancesLoading } =
    useDailyAttendancesInRange({
      from,
      to,
      snapshot: true,
    });

  /** EMPLOYEES DATA LAYER */
  const { docs: employees, loading: employeesLoading } = useEmployeesInRange({
    from,
    to,
    snapshot: true,
  });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const loadingsKey = Vue.ref(null);

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
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

  /*****************************************************************************
   * SCOPE DISPOSE
   *****************************************************************************/
  /**
   * スコープ外になった際に、ロード中のインジケータを削除します。
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
    dailyAttendances,
    employees,
    loading,
  };
}
