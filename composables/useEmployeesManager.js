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
 * @param {*} options - Options for the employees manager
 * @param {Array} options.docs - Array of employee document instances to manage
 * @param {string} options.redirectPath - Path to redirect after creation
 * @param {boolean|number} options.useDelay - Whether to use delay for reflection of `search` string in ms
 * @param {Array} options.sortBy - Array of sorting criteria
 * @param {Function} options.onUpdateSearch - Callback function when search is updated
 * @returns {Object} - Employees manager attributes and information.
 * @returns {Object} attrs - Computed attributes for the collection component
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} isLoading - Reactive loading state
 * @returns {Object} router - Vue Router instance for navigation
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useEmployeesManager(
  {
    docs,
    redirectPath = "/employees",
    useDelay = false,
    sortBy = [{ key: "code", order: "desc" }],
    onUpdateSearch,
  } = {},
  additionalAttrs = {}
) {
  /** SETUP */
  const collectionManager = useCollectionManager(
    "useEmployeesManager",
    {
      docs,
      schema: Employee,
      redirectPath,
      useDelay,
      sortBy,
      onUpdateSearch,
    },
    additionalAttrs
  );

  /** COMPUTED PROPERTIES */
  const attrs = Vue.computed(() => {
    return {
      ...collectionManager.attrs.value,
    };
  });

  return {
    ...collectionManager,
    attrs,
  };
}
