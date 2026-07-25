import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { useFetch } from "@/composables/fetch/useFetch";
import { Billing } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/*****************************************************************************
 * @file ./composables/dataLayers/billing/useBillingsInRange.js
 * @description Billing range data layer composable.
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @returns {{
 *   docs: import("vue").ComputedRef<Billing[]>
 * }}
 *****************************************************************************/
export function useBillingsInRange({ from, to } = {}) {
  const { isDev } = useAuthStore();

  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  /** Validate `from` and `to` are Ref<Date>. */
  rangeIsRef({ from, to });

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useBillingsInRange");
  const { fetchCustomerComposable, fetchSiteComposable } =
    useFetch("useBillingsInRange");
  const { fetchCustomer } = fetchCustomerComposable;
  const { fetchSite } = fetchSiteComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new Billing());

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

    const constraints = [
      ["where", "billingDateAt", ">=", fromDate],
      ["where", "billingDateAt", "<=", toDate],
    ];
    try {
      instance.subscribeDocs({ constraints }, (doc) => {
        fetchCustomer(doc.customerId);
        fetchSite(doc.siteId);
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
  Vue.onScopeDispose(() => instance.unsubscribe());

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return { docs };
}
