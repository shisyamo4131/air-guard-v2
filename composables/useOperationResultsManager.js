/***************************************************************************
 * useOperationResultsManager
 * @version 1.0.0
 * @description A composable to manage OperationResult instances
 *              within a specified date range and optional siteId.
 *              Requires a dateRange composable to function.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationResult, Site } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useLogger } from "../composables/useLogger";
import { useRouter } from "vue-router";

/**
 * @param {*} options
 * @param {Object} options.dateRangeComposable - An instance of useDateRange composable
 * @param {boolean} options.useDebounced - Whether to use debounced date range (default: false)
 * @param {Object} options.fetchSiteComposable - An instance of useFetchSite composable (optional)
 * @param {boolean} options.immediate - Whether to immediately set up the subscription (default: false)
 * @returns {Object} - The operation results manager composable
 * @returns {Array} docs - Array of OperationResult documents
 * @returns {Object} attrs - Computed attributes for the operation results component
 * @returns {Array} cachedSites - Array of cached site documents
 * @returns {Function} set - Method to set OperationResult to update.
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useOperationResultsManager({
  dateRangeComposable,
  useDebounced = false,
  fetchSiteComposable,
  immediate = false,
} = {}) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger("OperationResultsManager", useErrorsStore());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  if (!dateRangeComposable) {
    throw new Error("dateRangeComposable is required");
  }

  if (isDev && !fetchSiteComposable) {
    const missingComposables = [];
    if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
    if (missingComposables.length > 0) {
      logger.info({
        message: `The following composables were not provided. Internal composables will be used, but if caching across multiple components is needed, specifying them will improve performance: ${missingComposables.join(
          ", "
        )}`,
      });
    }
  }

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const siteId = Vue.ref(null);
  const instance = Vue.reactive(new OperationResult());
  const component = Vue.ref(null);

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const router = useRouter();
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Subscribe to OperationResult documents based on date range and siteId.
   * - siteId is optional; if not provided, all sites are considered.
   * @returns {void}
   */
  function _subscribe() {
    const dateRange = useDebounced
      ? dateRangeComposable.debouncedDateRange.value
      : dateRangeComposable.dateRange.value;
    const { from, to } = dateRange;
    if (!from || !to) return;
    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];
    if (siteId.value) {
      constraints.push(["where", "siteId", "==", siteId.value]);
    }
    instance.subscribeDocs({ constraints }, fetchSite);
  }

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  function subscribe({ siteId: inputSiteId } = {}) {
    if (inputSiteId && typeof inputSiteId === "string") {
      siteId.value = Vue.unref(inputSiteId);
    }
    _subscribe();
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  const targetDateRange = useDebounced
    ? dateRangeComposable.debouncedDateRange
    : dateRangeComposable.dateRange;
  Vue.watch(targetDateRange, _subscribe);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const enrichedDocs = Vue.computed(() => {
    return instance.docs.map((doc) => {
      const site = cachedSites.value[doc.siteId] || new Site();
      return {
        ...doc.toObject(),
        site,
      };
    });
  });

  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      beforeEdit: (editMode, item) => {
        if (editMode === "CREATE") return true;
        router.push(`/operation-results/${item.docId}`);
        return false;
      },
      handleCreate: (item) => item.create(),
      modelValue: instance.docs,
      schema: OperationResult,
      inputProps: {
        excludedKeys: [
          "employees",
          "outsourcers",
          "unitPriceBase",
          "overtimeUnitPriceBase",
          "unitPriceQualified",
          "overtimeUnitPriceQualified",
          "billingUnitType",
          "includeBreakInBilling",
          "cutoffDate",
          "isLocked",
          "billingDateAt",
          "useAdjustedQuantity",
          "adjustedQuantityBase",
          "adjustedOvertimeBase",
          "adjustedQuantityQualified",
          "adjustedOvertimeQualified",
          "agreement",
          "allowEmptyAgreement",
        ],
      },
      tableProps: {
        headers: [
          {
            title: "日付",
            key: "dateAt",
            value: (item) => dayjs(item.dateAt).format("MM月DD日(ddd)"),
          },
          { title: "現場", key: "siteId" },
        ],
        items: enrichedDocs.value,
        sortBy: [{ key: "dateAt", order: "desc" }],
      },
      onCreate: ($event) => router.push(`operation-results/${$event.docId}`),
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /**
   * Mapped documents by their docId
   */
  const keyMappedDocs = Vue.computed(() => {
    return instance.docs.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  if (immediate) subscribe(immediate);

  /***************************************************************************
   * RETURN OBJECT
   ***************************************************************************/
  return {
    docs: Vue.readonly(instance.docs),
    keyMappedDocs: Vue.readonly(keyMappedDocs),
    cachedSites: Vue.readonly(cachedSites),
    attrs: Vue.readonly(attrs),

    subscribe,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
