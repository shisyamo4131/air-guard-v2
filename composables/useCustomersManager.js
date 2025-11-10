/*****************************************************************************
 * useCustomersManager
 * @version 1.0.0
 * @description A composable to manage customers information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Customer } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";

// Constraints to fetch only active customers.
const statusOption = ["where", "contractStatus", "==", Customer.STATUS_ACTIVE];

// Default sorting by customer code in descending order.
const sortBy = [{ key: "code", order: "desc" }];

/**
 * @returns {Object} - Customers manager attributes and information.
 * @returns {Object} attrs - The attributes for the customers manager.
 * @returns {Array} docs - The array of customer documents.
 */
export function useCustomersManager() {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("CustomersManager", useErrorsStore());

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Customer());
  const search = Vue.ref("");
  const loading = Vue.ref(false);

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe() {
    logger.clearError();
    try {
      loading.value = true;
      const constraints = search.value ? search.value : [statusOption];
      const options = search.value ? [statusOption] : [];
      instance.subscribeDocs({ constraints, options });
    } catch (error) {
      logger.error({ error, message: "Failed to fetch customers." });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the customers manager. */
  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.docs,
      schema: Customer,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: 300,
      loading: loading.value,
      search: search.value,
      tableProps: { customFilter: () => true, sortBy },
      "onUpdate:search": (val) => (search.value = val),
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    attrs,
    docs: Vue.readonly(instance.docs),
  };
}
