/**
 * @file composables/useCustomersManager.js
 * @description A composable to manage customers.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { Customer } from "@/schemas";

/***************************************************************************
 * A composable to manage customers.
 *
 * @function useCustomersManager
 * @version 1.0.0
 * @returns {Object} attrs - The attributes for the customers manager.
 * @returns {Array} docs - The array of customer documents.
 ***************************************************************************/
export function useCustomersManager() {
  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Customer());
  const search = Vue.ref("");
  const loading = Vue.ref(false);

  /***************************************************************************
   * COMPOSABLES
   ***************************************************************************/
  const { error, clearError } = useLogger("CustomersManager", useErrorsStore());

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  function subscribe() {
    try {
      loading.value = true;
      const statusOption = [
        "where",
        "contractStatus",
        "==",
        Customer.STATUS_ACTIVE,
      ];
      const constraints = search.value ? search.value : [statusOption];
      const options = search.value ? [statusOption] : [];
      instance.subscribeDocs({ constraints, options });
    } catch (error) {
      error({ error, message: "Failed to fetch customers." });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(subscribe);

  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.docs,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: 300,
      schema: Customer,
      search: search.value,
      tableProps: {
        customFilter: () => true,
        sortBy: [{ key: "code", order: "desc" }],
      },
      "onUpdate:search": (val) => (search.value = val),
      onError: (e) => error({ error: e }),
      "onError:clear": clearError,
    };
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => instance.unsubscribe());

  return {
    attrs,
    docs: computed(() => instance.docs),
  };
}
