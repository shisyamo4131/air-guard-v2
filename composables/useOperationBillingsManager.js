/*****************************************************************************
 * useOperationBillingsManager ver 1.0.0
 * @author shisyamo4131
 * @description A composable to manage operation billings.
 * ---------------------------------------------------------------------------
 * @props {Date} baseDate - The base date for the date range.
 * @props {Date} endDate - The end date for the date range.
 * @props {Array} excludedKeys - The keys to exclude from the input props.
 * ---------------------------------------------------------------------------
 * @returns {Object} attrs - The attributes for the operation billings manager.
 * @returns {Object} cachedSites - The cached sites from useFetchSite.
 * @returns {Object} dateRange - The reactive date range object.
 * @returns {Array} docs - The array of operation billing documents.
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationBilling } from "@/schemas";
import { useDateRange } from "@/composables/useDateRange";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useLogger } from "../composables/useLogger";
import { useRouter } from "vue-router";

export function useOperationBillingsManager({
  baseDate = dayjs().startOf("month").toDate(),
  endDate = dayjs().endOf("month").toDate(),
} = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const router = useRouter();

  const { error, clearError } = useLogger(
    "OperationBillingsManager",
    useErrorsStore()
  );

  const { dateRange, debouncedDateRange } = useDateRange({
    baseDate,
    endDate,
  });

  const { fetchSite, cachedSites } = useFetchSite();

  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new OperationBilling());

  /***************************************************************************
   * DEFINE WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /***************************************************************************
   * DEFINE COMPUTED PROPERTIES
   ***************************************************************************/
  const attrs = Vue.computed(() => {
    return {
      beforeEdit: (editMode, item) => {
        if (editMode === "CREATE") return false; // Disable creation
        router.push(`operation-billings/${item.docId}`);
        return false;
      },
      modelValue: instance.docs,
      schema: OperationBilling,
      tableProps: {
        hideCreateButton: true,
        sortBy: [{ key: "dateAt", order: "desc" }],
      },
      onError: error,
      "onError:clear": clearError,
    };
  });

  /***************************************************************************
   * DEFINE METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe() {
    const { from, to } = debouncedDateRange.value;
    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];

    instance.subscribeDocs({ constraints }, fetchSite);
  }

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  return {
    attrs,
    cachedSites,
    dateRange,
    docs: computed(() => instance.docs),
  };
}
