/***************************************************************************
 * useSiteOperationSchedulesManager
 * @version 1.0.0
 * @description A composable to manage SiteOperationSchedule instances
 *              within a specified date range and optional siteId.
 *              Requires a dateRange composable to function.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
// import { useFetchSite } from "@/composables/fetch/useFetchSite";
// import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
// import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.dateRangeComposable - An instance of useDateRange composable
 * @param {boolean} options.useDebounced - Whether to use debounced date range (default: false)
 * @param {Object} options.fetchSiteComposable - An instance of useFetchSite composable (optional)
 * @param {boolean} options.immediate - Whether to immediately set up the subscription (default: false)
 * @returns {Object} - The site operation schedules manager composable
 * @returns {Array} docs - Array of SiteOperationSchedule documents
 * @returns {Object} keyMappedDocs - Object mapping docId to SiteOperationSchedule documents
 * @returns {Array} events - Array of event objects derived from the schedules
 * @returns {Object} attrs - Computed attributes for the site operation schedules component
 * @returns {Object} cachedSites - Object of cached site documents
 * @returns {Function} set - Method to set SiteOperationSchedule to update.
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useSiteOperationSchedulesManager({
  docs,
  // dateRangeComposable,
  // useDebounced = false,
  // fetchSiteComposable,
  // fetchEmployeeComposable,
  // fetchOutsourcerComposable,
  // immediate = false,
} = {}) {
  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  // if (!dateRangeComposable) {
  //   throw new Error("dateRangeComposable is required");
  // }

  /***************************************************************************
   * STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("SiteOperationSchedulesManager", useErrorsStore());
  // const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  // const { fetchEmployee, cachedEmployees } =
  //   fetchEmployeeComposable || useFetchEmployee();
  // const { fetchOutsourcer, cachedOutsourcers } =
  //   fetchOutsourcerComposable || useFetchOutsourcer();
  // const missingComposables = [];
  // if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
  // if (!fetchEmployeeComposable)
  //   missingComposables.push("fetchEmployeeComposable");
  // if (!fetchOutsourcerComposable)
  //   missingComposables.push("fetchOutsourcerComposable");
  // if (missingComposables.length > 0) {
  //   logger.info({
  //     message: `Consider providing the following composables to improve performance by caching data across multiple usages: ${missingComposables.join(
  //       ", "
  //     )}`,
  //   });
  // }

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  // const siteId = Vue.ref(null);
  // const instance = Vue.reactive(new SiteOperationSchedule());
  const component = Vue.ref(null);

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  // /**
  //  * Subscribe to SiteOperationSchedule documents based on date range and siteId.
  //  * - siteId is optional; if not provided, all sites are considered.
  //  * @returns {void}
  //  */
  // function _subscribe() {
  //   const dateRange = useDebounced
  //     ? dateRangeComposable.debouncedDateRange.value
  //     : dateRangeComposable.dateRange.value;
  //   const { from, to } = dateRange;
  //   if (!from || !to) return;
  //   const constraints = [
  //     ["where", "dateAt", ">=", from],
  //     ["where", "dateAt", "<=", to],
  //   ];
  //   if (siteId.value) {
  //     constraints.push(["where", "siteId", "==", siteId.value]);
  //   }
  //   instance.subscribeDocs({ constraints }, (item) => {
  //     fetchSite(item.siteId);
  //     fetchEmployee(item.employeeIds);
  //     fetchOutsourcer(item.outsourcerIds);
  //   });
  // }

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  // function set({ siteId: inputSiteId } = {}) {
  //   if (inputSiteId !== undefined) {
  //     siteId.value = Vue.unref(inputSiteId);
  //   }
  //   _subscribe();
  // }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  // const targetDateRange = useDebounced
  //   ? dateRangeComposable.debouncedDateRange
  //   : dateRangeComposable.dateRange;
  // Vue.watch(targetDateRange, _subscribe);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  // Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    // const beforeEdit = (_, item) => {
    //   if (siteId.value) {
    //     item.siteId = siteId.value;
    //   }
    // };
    return {
      ref: (el) => (component.value = el),
      // modelValue: instance.docs,
      modelValue: docs,
      schema: SiteOperationSchedule,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      // beforeEdit,
      disableUpdate: (item) => !!item.operationResultId,
      disableDelete: (item) => !!item.operationResultId,
      inputProps: {
        excludedKeys: ["siteId", "employees", "outsourcers"],
      },
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /**
   * Mapped documents by their docId
   */
  const keyMappedDocs = Vue.computed(() => {
    // return instance.docs.reduce((acc, doc) => {
    //   acc[doc.docId] = doc;
    //   return acc;
    // }, {});
    return docs.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  /** Mapped events object */
  const events = Vue.computed(() => {
    // return instance.docs.map((doc) => doc.toEvent());
    return docs.map((doc) => doc.toEvent());
  });

  // if (immediate) set(immediate);

  /***************************************************************************
   * RETURN OBJECT
   ***************************************************************************/
  return {
    // docs: Vue.readonly(instance.docs),
    docs: Vue.readonly(docs),
    keyMappedDocs: Vue.readonly(keyMappedDocs),
    events: Vue.readonly(events),

    attrs: Vue.readonly(attrs),

    // cachedSites: Vue.readonly(cachedSites),
    // cachedEmployees: Vue.readonly(cachedEmployees),
    // cachedOutsourcers: Vue.readonly(cachedOutsourcers),

    // set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
