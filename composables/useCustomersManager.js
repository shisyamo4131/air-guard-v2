/*****************************************************************************
 * useCustomersManager
 * @version 1.0.0
 * @description A composable to manage customers information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Customer } from "@/schemas";
import { useCollectionManager } from "@/composables/useCollectionManager";

/**
 * @returns {Object} - Customers manager attributes and information.
 * @returns {Object} attrs - The attributes for the customers manager.
 * @returns {Array} docs - The array of customer documents.
 */
export function useCustomersManager(
  {
    docs,
    redirectPath = "/customers",
    useDelay = false,
    sortBy = [{ key: "code", order: "desc" }],
    onUpdateSearch,
  } = {},
  additionalAttrs = {}
) {
  /** SETUP */
  const collectionManager = useCollectionManager("useCustomersManager", {
    docs,
    schema: Customer,
    redirectPath,
    useDelay,
    sortBy,
    onUpdateSearch,
    additionalAttrs,
  });

  /** COMPUTED PROPERTIES */
  const attrs = Vue.computed(() => {
    return {
      ...collectionManager.attrs.value,
    };
  });

  return { attrs };
}
