/***************************************************************************
 * useOperationResultsManager
 * @version 1.0.0
 * @description A composable to manage OperationResult instances
 *              within a specified date range and optional siteId.
 *              Requires a dateRange composable to function.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { OperationResult } from "@/schemas";
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
  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  if (!dateRangeComposable) {
    throw new Error("dateRangeComposable is required");
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
  const logger = useLogger("OperationResultsManager", useErrorsStore());
  const router = useRouter();

  // If fetchSiteComposable is not provided, use internal useFetchSite
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  if (!fetchSiteComposable) {
    logger.info({
      message:
        "fetchSiteComposable is not provided. Using internal useFetchSite. If you need to cache site information across multiple composables, specifying fetchSiteComposable will improve performance.",
    });
  }

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
  function set({ siteId: inputSiteId } = {}) {
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
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const attrs = Vue.computed(() => {
    return {
      beforeEdit: (editMode, item) => {
        if (editMode === "CREATE") return true;
        router.push(`operation-results/${item.docId}`);
        return false;
      },
      handleCreate: (item) => item.create(),
      modelValue: instance.docs,
      schema: OperationResult,
      tableProps: {
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

  if (immediate) set();

  /***************************************************************************
   * RETURN OBJECT
   ***************************************************************************/
  return {
    docs: Vue.readonly(instance.docs),
    keyMappedDocs: Vue.readonly(keyMappedDocs),
    cachedSites: Vue.readonly(cachedSites),
    attrs: Vue.readonly(attrs),

    set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
