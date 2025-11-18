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
import { Site, SiteOperationSchedule } from "@/schemas";

const isDebug = false;

/**
 * @param {*} options
 * @param {*} options.docId - The document ID of the Site to subscribe to
 * @param {*} options.dateRangeComposable
 * @param {*} options.useDebounced - Whether to use debounced date range (default: false)
 * @returns
 */
export function useSite({
  docId,
  dateRangeComposable,
  useDebounced = false,
} = {}) {
  const site = Vue.reactive(new Site());
  const siteOperationSchedule = Vue.reactive(new SiteOperationSchedule());

  const sendDebugLog = (message) => {
    if (isDebug) console.info(`[useSite.js] ${message}`);
  };

  sendDebugLog("Initializing useSite composable...");

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
    sendDebugLog("Subscribing to Site document...");
    site.subscribe({ docId });
  }

  function _subscribeSiteOperationSchedules() {
    sendDebugLog("Subscribing to SiteOperationSchedule documents...");
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
  Vue.onMounted(() => {
    sendDebugLog("Mounted");
  });

  Vue.onUnmounted(() => {
    sendDebugLog("Unmounted");
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
