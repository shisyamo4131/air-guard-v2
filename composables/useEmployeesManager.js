/*****************************************************************************
 * useEmployeesManager
 * @version 1.0.0
 * @description A composable to manage employees information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "./useLogger";
import { Employee } from "@/schemas";

// Constraints to fetch only active employees.
const statusOption = [
  "where",
  "employmentStatus",
  "==",
  Employee.STATUS_ACTIVE,
];

// Default sorting by employee code in descending order.
const sortBy = [{ key: "code", order: "desc" }];

/**
 * @returns {Object} - Employees manager attributes and information.
 * @returns {Object} attrs - The attributes for the employees manager.
 * @returns {Array} docs - The array of employee documents.
 */
export function useEmployeesManager() {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("EmployeesManager", useErrorsStore());

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Employee());
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
      logger.error({ error });
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

  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.docs,
      schema: Employee,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: 300,
      search: search.value,
      tableProps: { customFilter: () => true, sortBy },
      "onUpdate:search": (val) => (search.value = val),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": () => logger.clearError(),
    };
  });

  return {
    attrs,
    docs: Vue.readonly(instance.docs),
  };
}
