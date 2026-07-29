/*****************************************************************************
 * @file composables/application/dailyOperationByEmployee/useDailyOperationsByEmployeeIndexData.js
 * @description 従業員別勤怠確認画面で使用する稼働日基準データを提供します。
 *****************************************************************************/
import * as Vue from "vue";
import { useDailyOperationsByEmployeeInRange } from "@/composables/dataLayers/dailyOperationByEmployee/useDailyOperationsByEmployeeInRange";
import { useEmployeesInRange } from "@/composables/dataLayers/employee/useEmployeesInRange";
import { rangeIsRef } from "@/composables/validators/rangeValidator";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { DailyOperationByEmployee, Employee } from "@/schemas";

/**
 * @param {{ from: import('vue').Ref<Date>, to: import('vue').Ref<Date> }} options
 * @returns {{
 *  dailyOperationsByEmployee: import('vue').ComputedRef<Array<DailyOperationByEmployee>>,
 *  employees: import('vue').ComputedRef<Array<Employee>>,
 *  loading: import('vue').ComputedRef<boolean>
 * }}
 */
export function useDailyOperationsByEmployeeIndexData({ from, to } = {}) {
  rangeIsRef({ from, to });

  const loadingsStore = useLoadingsStore();

  const {
    docs: dailyOperationsByEmployee,
    loading: dailyOperationsLoading,
  } = useDailyOperationsByEmployeeInRange({
    from,
    to,
    snapshot: true,
  });

  const { docs: employees, loading: employeesLoading } = useEmployeesInRange({
    from,
    to,
    snapshot: true,
  });

  const loadingsKey = Vue.ref(null);
  const loading = Vue.computed(
    () => dailyOperationsLoading.value || employeesLoading.value,
  );

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

  Vue.onScopeDispose(() => {
    if (loadingsKey.value) {
      loadingsStore.remove(loadingsKey.value);
      loadingsKey.value = null;
    }
  });

  return {
    dailyOperationsByEmployee,
    employees,
    loading,
  };
}
