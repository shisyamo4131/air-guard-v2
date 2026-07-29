/*****************************************************************************
 * @file composables/dataLayers/dailyOperationByEmployee/useDailyOperationsByEmployeeInRange.js
 * @description 指定期間のDailyOperationByEmployeeを取得します。
 *****************************************************************************/
import * as Vue from "vue";
import { DailyOperationByEmployee } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/**
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @param {boolean} [options.snapshot=false]
 * @returns {{
 *   docs: import("vue").ComputedRef<DailyOperationByEmployee[]>,
 *   loading: import("vue").Ref<boolean>
 * }}
 */
export function useDailyOperationsByEmployeeInRange({
  from,
  to,
  snapshot = false,
} = {}) {
  rangeIsRef({ from, to });

  const logger = useLogger(
    "useDailyOperationsByEmployeeInRange",
    useErrorsStore(),
  );
  const instance = Vue.reactive(new DailyOperationByEmployee());
  const docs = Vue.ref([]);
  const loading = Vue.ref(false);

  function subscribe([fromDate, toDate]) {
    rangeIsValid({ from: fromDate, to: toDate });

    try {
      docs.value = instance.subscribeDocs({
        constraints: [
          ["where", "dateAt", ">=", fromDate],
          ["where", "dateAt", "<=", toDate],
        ],
      });
    } catch (error) {
      logger.error({
        message: "Failed to subscribe DailyOperationsByEmployee.",
        error,
        data: { fromDate, toDate },
      });
      instance.unsubscribe();
    }
  }

  async function fetch([fromDate, toDate]) {
    rangeIsValid({ from: fromDate, to: toDate });

    loading.value = true;
    try {
      docs.value = await instance.fetchDocs({
        constraints: [
          ["where", "dateAt", ">=", fromDate],
          ["where", "dateAt", "<=", toDate],
        ],
      });
    } catch (error) {
      logger.error({
        message: "Failed to fetch DailyOperationsByEmployee.",
        error,
        data: { fromDate, toDate },
      });
    } finally {
      loading.value = false;
    }
  }

  Vue.watch(
    [from, to],
    async ([fromDate, toDate]) => {
      if (snapshot) {
        await fetch([fromDate, toDate]);
      } else {
        subscribe([fromDate, toDate]);
      }
    },
    { immediate: true },
  );

  Vue.onScopeDispose(() => instance.unsubscribe());

  return {
    docs: Vue.computed(() => [...docs.value]),
    loading,
  };
}
