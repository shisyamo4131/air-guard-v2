/*****************************************************************************
 * useEmployeesManager
 * @version 1.0.0
 * @description A composable to manage employees information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Employee } from "@/schemas";
import { useCollectionManager } from "@/composables/useCollectionManager";

/**
 * @returns {Object} - Employees manager attributes and information.
 * @returns {Object} attrs - The attributes for the employees manager.
 * @returns {Array} docs - The array of employee documents.
 */
export function useEmployeesManager({
  docs,
  sortBy = [{ key: "code", order: "desc" }],
} = {}) {
  /** SETUP */
  const collectionManager = useCollectionManager("useEmployeesManager", {
    docs,
    schema: Employee,
    createRedirectPath: "/employees",
    useDelay: false,
    sortBy,
  });

  /** COMPUTED PROPERTIES */
  const attrs = Vue.computed(() => {
    return {
      ...collectionManager.attrs.value,
    };
  });

  return { attrs };
}
