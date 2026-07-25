/*****************************************************************************
 * @file composables/dataLayers/dailyAttendance/useDailyAttendancesInRange.js
 * @description 指定期間のDailyAttendanceと関連従業員を取得する。
 *****************************************************************************/
import * as Vue from "vue";
import { DailyAttendance } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";
import { useLogger } from "@/composables/useLogger";

/**
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @returns {{
 *   docs: import("vue").ComputedRef<DailyAttendance[]>,
 *   employeesById: import("vue").ComputedRef<Object>,
 *   loadingEmployees: import("vue").ComputedRef<boolean>
 * }}
 */
export function useDailyAttendancesInRange({ from, to } = {}) {
  if (!Vue.isRef(from) || !Vue.isRef(to)) {
    throw new TypeError(
      "Invalid 'from' or 'to' option. Both must be Ref<Date>.",
    );
  }

  const logger = useLogger("useDailyAttendancesInRange");
  const { fetchEmployeeComposable } = useFetch("useDailyAttendancesInRange");
  const {
    fetchEmployee,
    cachedEmployees,
    isLoading: loadingEmployees,
  } = fetchEmployeeComposable;
  const instance = Vue.reactive(new DailyAttendance());

  function validateDateValues([fromDate, toDate]) {
    if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
      throw new TypeError("'from' and 'to' must be Date instances.");
    }
    if (fromDate > toDate) {
      throw new RangeError("'from' must be earlier than or equal to 'to'.");
    }
  }

  function subscribe([fromDate, toDate]) {
    validateDateValues([fromDate, toDate]);

    try {
      instance.subscribeDocs({
        constraints: [
          ["where", "dateAt", ">=", fromDate],
          ["where", "dateAt", "<=", toDate],
        ],
      });
    } catch (error) {
      logger.error({
        message: "Failed to subscribe DailyAttendances.",
        error,
        data: { fromDate, toDate },
      });
      instance.unsubscribe();
    }
  }

  Vue.watch([from, to], ([fromDate, toDate]) => subscribe([fromDate, toDate]), {
    immediate: true,
  });

  Vue.watch(
    () => instance.docs.map(({ employeeId }) => employeeId),
    (employeeIds) => fetchEmployee(employeeIds),
    { immediate: true },
  );

  Vue.onScopeDispose(() => instance.unsubscribe());

  return {
    docs: Vue.computed(() => [...instance.docs]),
    employeesById: cachedEmployees,
    loadingEmployees,
  };
}
