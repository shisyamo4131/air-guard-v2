/*****************************************************************************
 * useOperationResultsManager ver 1.0.0
 * @author shisyamo4131
 * @description A composable to manage operation results.
 * ---------------------------------------------------------------------------
 * @props {Date} baseDate - The base date for the date range.
 * @props {Date} endDate - The end date for the date range.
 * @props {Array} excludedKeys - The keys to exclude from the input props.
 * ---------------------------------------------------------------------------
 * @returns {Object} - The operation results manager composable.
 * @returns {Object} attrs - The attributes for the operation results manager.
 * @returns {Object} cachedSites - The cached sites from useFetchSite.
 * @returns {Object} dateRange - The reactive date range object.
 * @returns {Array} docs - The array of operation result documents.
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";
import { useDateRange } from "@/composables/useDateRange";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useLogger } from "../composables/useLogger";
import { useRouter } from "vue-router";

export function useOperationResultsManager({
  baseDate = dayjs().startOf("month").toDate(),
  endDate = dayjs().endOf("month").toDate(),
  excludedKeys = [
    "status",
    "employees",
    "outsourcers",
    "unitPriceBase",
    "overtimeUnitPriceBase",
    "unitPriceQualified",
    "overtimeUnitPriceQualified",
    "billingUnitType",
    "includeBreakInBilling",
    "siteOperationScheduleId",
    "useAdjustedQuantity",
    "adjustedQuantityBase",
    "adjustedOvertimeBase",
    "adjustedQuantityQualified",
    "adjustedOvertimeQualified",
  ],
} = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const router = useRouter();

  const { error, clearError } = useLogger(
    "OperationResultsManager",
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
  const instance = Vue.reactive(new OperationResult());

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
        if (editMode === "CREATE") return true;
        router.push(`operation-results/${item.docId}`);
        return false;
      },
      handleCreate: (item) => item.create(),
      inputProps: {
        excludedKeys,
      },
      modelValue: instance.docs,
      schema: OperationResult,
      tableProps: {
        sortBy: [{ key: "dateAt", order: "desc" }],
      },
      onCreate: ($event) => router.push(`operation-results/${$event.docId}`),
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
