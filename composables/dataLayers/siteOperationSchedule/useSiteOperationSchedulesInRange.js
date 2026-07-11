import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { useFetch } from "@/composables/fetch/useFetch";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/*****************************************************************************
 * @file ./composables/dataLayers/siteOperationSchedule/useSiteOperationSchedulesInRange.js
 * @description SiteOperationSchedule range data layer composable.
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @returns {{
 *   docs: import("vue").ComputedRef<SiteOperationSchedule[]>
 * }}
 *****************************************************************************/
export function useSiteOperationSchedulesInRange({ from, to } = {}) {
  const { isDev } = useAuthStore();

  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  if (!Vue.isRef(from) || !Vue.isRef(to)) {
    throw new TypeError(
      "Invalid 'from' or 'to' option. Both must be Ref<Date>.",
    );
  }

  /*****************************************************************************
   * VALIDATORS
   *****************************************************************************/
  function validateDateValues([fromDate, toDate]) {
    if (!(fromDate instanceof Date)) {
      throw new TypeError("Invalid 'from' value. Must be a Date instance.");
    }

    if (!(toDate instanceof Date)) {
      throw new TypeError("Invalid 'to' value. Must be a Date instance.");
    }

    if (fromDate > toDate) {
      throw new RangeError("'from' must be earlier than or equal to 'to'.");
    }
  }

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useSiteOperationSchedulesInRange");
  const {
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  } = useFetch("useSiteOperationSchedulesInRange");
  const { fetchSite } = fetchSiteComposable;
  const { fetchEmployee } = fetchEmployeeComposable;
  const { fetchOutsourcer } = fetchOutsourcerComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe([fromDate, toDate]) {
    validateDateValues([fromDate, toDate]);
    const constraints = [
      ["where", "dateAt", ">=", fromDate],
      ["where", "dateAt", "<=", toDate],
    ];
    try {
      instance.subscribeDocs({ constraints }, (doc) => {
        if (typeof fetchSite === "function") {
          fetchSite(doc.siteId);
        }
        if (typeof fetchEmployee === "function") {
          fetchEmployee(doc.employeeIds);
        }
        if (typeof fetchOutsourcer === "function") {
          fetchOutsourcer(doc.outsourcerIds);
        }
      });
    } catch (error) {
      logger.error({
        message: "Failed to subscribe with given 'from' and 'to' values.",
        error,
        data: { fromDate, toDate },
      });
      instance.unsubscribe();
    }
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(
    [from, to],
    ([newFrom, newTo]) => {
      if (isDev) {
        const message = "'from' or 'to' changed. Subscribing with new values.";
        logger.debug({ message, data: { newFrom, newTo } });
      }
      subscribe([newFrom, newTo]);
    },
    { immediate: true },
  );

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const docs = Vue.computed(() => {
    const map = new Map();
    for (const doc of instance.docs) {
      map.set(doc.docId, doc);
    }
    return [...map.values()];
  });

  /*****************************************************************************
   * CLEANUP
   *****************************************************************************/
  Vue.onScopeDispose(() => {
    instance.unsubscribe();
  });

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    docs,
  };
}
