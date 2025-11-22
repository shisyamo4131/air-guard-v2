/*****************************************************************************
 * useSite
 * @version 1.0.0
 * @description A data layer composable for site details.
 * - Subscribes to site and date ranged `SiteOperationSchedule` documents immediately.
 * - Requires dateRange composable.
 * @author shisyamo4131
 * @create 2025-11-14
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { Site, SiteOperationSchedule } from "@/schemas";

/**
 * @param {*} options
 * @param {*} options.docId - The document ID of the Site to subscribe to
 * @param {*} options.dateRangeComposable
 * @param {*} options.useDebounced - Whether to use debounced date range (default: false)
 * @returns {Object} - The site data layer composable
 * @returns {Object} doc - Reactive Site instance
 * @returns {Array} schedules - Reactive array of SiteOperationSchedule instances
 */
export function useSite({
  docId,
  dateRangeComposable,
  useDebounced = false,
} = {}) {
  const site = Vue.reactive(new Site());
  const siteOperationSchedule = Vue.reactive(new SiteOperationSchedule());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  // Validate docId
  if (!docId || typeof docId !== "string") {
    throw new Error("A valid docId string is required");
  }

  // Validate required composables
  const missingComps = [];
  if (!dateRangeComposable) missingComps.push("dateRangeComposable");
  if (missingComps.length > 0) {
    throw new Error(
      `Required composables are missing: ${missingComps.join(", ")}`
    );
  }

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Computed dateRange based on whether debounced is used.
   * - If useDebounced is true, uses debouncedDateRange from dateRangeComposable.
   * - Otherwise, uses dateRange from dateRangeComposable.
   * @returns {Object} dateRange with from and to properties.
   */
  const _dateRange = Vue.computed(() => {
    return useDebounced
      ? dateRangeComposable.debouncedDateRange.value
      : dateRangeComposable.dateRange.value;
  });

  function _subscribeSite() {
    site.subscribe({ docId });
  }

  function _subscribeSiteOperationSchedules() {
    // generate constraints
    const { from, to } = _dateRange.value;
    const constraints = [
      ["where", "siteId", "==", docId],
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];
    siteOperationSchedule.subscribeDocs({ constraints });
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(() => {
    _subscribeSite();
    _subscribeSiteOperationSchedules();
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    site.unsubscribe();
    siteOperationSchedule.unsubscribe();
  });

  /***************************************************************************
   * RETURNED OBJECTS
   ***************************************************************************/
  return {
    doc: site,
    schedules: Vue.readonly(siteOperationSchedule.docs),
  };
}
