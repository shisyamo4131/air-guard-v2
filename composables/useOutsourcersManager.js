/*****************************************************************************
 * useOutsourcersManager
 * @version 1.0.0
 * @description A composable to manage outsourcers information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { Outsourcer } from "@/schemas";

// Constraints to fetch only active outsourcers.
const statusOption = [
  "where",
  "contractStatus",
  "==",
  Outsourcer.STATUS_ACTIVE,
];

// Default sorting by employee code in descending order.
const sortBy = [{ key: "code", order: "desc" }];

/**
 * @returns {Object} - Outsourcers manager attributes and information.
 * @returns {Object} attrs - The attributes for the outsourcers manager.
 * @returns {Array} docs - The array of outsourcer documents.
 */
export function useOutsourcersManager() {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("OutsourcersManager", useErrorsStore());

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Outsourcer());
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
      logger.error({ error, message: "Failed to fetch outsourcers." });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.docs,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: 300,
      schema: Outsourcer,
      search: search.value,
      tableProps: { customFilter: () => true, sortBy },
      "onUpdate:search": (val) => (search.value = val),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
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
