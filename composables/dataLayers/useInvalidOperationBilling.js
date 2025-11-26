/**
 * useInvalidOperationBilling.js
 * @description Composable for fetching OperationBilling documents marked as invalid.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { OperationBilling } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

export function useInvalidOperationBilling({
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  limit = 10,
}) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger("useInvalidOperationBilling", useErrorsStore());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /** VALIDATION */
  if (isDev) {
    const missingComposables = [];
    if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
    if (!fetchEmployeeComposable)
      missingComposables.push("fetchEmployeeComposable");
    if (!fetchOutsourcerComposable)
      missingComposables.push("fetchOutsourcerComposable");
    if (missingComposables.length > 0) {
      logger.info({
        message: `The following composables were not provided. Internal composables will be used, but if caching across multiple components is needed, specifying them will improve performance: ${missingComposables.join(
          ", "
        )}`,
      });
    }
  }

  /** SETUP REACTIVE OBJECTS */
  const instance = Vue.reactive(new OperationBilling());
  const internalLimit = Vue.ref(limit);

  /** SETUP COMPOSABLES */
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  const { fetchEmployee, cachedEmployees } =
    fetchEmployeeComposable || useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } =
    fetchOutsourcerComposable || useFetchOutsourcer();

  /** PRIVATE METHODS */
  function _subscribe() {
    const constraints = [
      ["where", "isInvalid", "!=", false],
      ["limit", internalLimit.value],
    ];
    const callback = (doc, changeType) => {
      if (changeType === "removed") return;
      fetchSite(doc.siteId);
      fetchEmployee(doc.employeeIds);
      fetchOutsourcer(doc.outsourcerIds);
    };
    instance.subscribeDocs({ constraints }, callback);
  }

  /** WATCHERS */
  Vue.watchEffect(_subscribe);

  /** LIFECYCLE HOOKS */
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  return {
    docs: Vue.readonly(instance.docs),

    cachedSites,
    cachedEmployees,
    cachedOutsourcers,
  };
}
