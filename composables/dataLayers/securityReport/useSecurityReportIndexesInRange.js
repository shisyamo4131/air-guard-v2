import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { SecurityReportIndex } from "@/schemas";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/*****************************************************************************
 * @file ./composables/dataLayers/securityReport/useSecurityReportIndexesInRange.js
 * @description SecurityReportIndex range data layer composable.
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @param {boolean} [options.snapshot=false] - `true` の場合、Firestoreのリアルタイム購読ではなく、単発の取得を行う。
 * @returns {{
 *   docs: import("vue").ComputedRef<SecurityReportIndex[]>,
 *   loading: import("vue").Ref<boolean>
 * }}
 *****************************************************************************/
export function useSecurityReportIndexesInRange({
  from,
  to,
  snapshot = false,
} = {}) {
  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  /** Validate `from` and `to` are Ref<Date>. */
  rangeIsRef({ from, to });

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useSecurityReportIndexesInRange");

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new SecurityReportIndex());
  const docs = Vue.ref([]);
  const loading = Vue.ref(false); // `true` の場合、データの取得中であることを表します。（snapshot モードでのフェッチ中に使用）

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

    const constraints = [
      ["where", "dateAt", ">=", fromDate],
      ["where", "dateAt", "<=", toDate],
    ];
    try {
      docs.value = instance.subscribeDocs({ constraints });
    } catch (error) {
      logger.error({
        message: "Failed to subscribe with given 'from' and 'to' values.",
        error,
        data: { fromDate, toDate },
      });
      instance.unsubscribe();
    }
  }

  async function fetch([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
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
        message: "Failed to fetch SecurityReportIndexes.",
        error,
        data: { fromDate, toDate },
      });
    } finally {
      loading.value = false;
    }
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
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

  /*****************************************************************************
   * CLEANUP
   *****************************************************************************/
  Vue.onScopeDispose(() => instance.unsubscribe());

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    docs: Vue.computed(() => [...docs.value]),
    loading,
  };
}
