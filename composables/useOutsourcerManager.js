/*****************************************************************************
 * useOutsourcerManager
 * @version 1.0.0
 * @description A composable to manage outsourcer information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Outsourcer } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive outsourcer instance to manage
 * @param {string} options.redirectPath - Path to redirect after deletion
 * @returns {Object} - The outsourcer manager composable
 * @returns {Object} doc - Reactive outsourcer instance
 * @returns {Object} attrs - Computed attributes for the outsourcer component
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useOutsourcerManager({
  doc = Vue.reactive(new Outsourcer()),
  redirectPath = "/outsourcers",
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useOutsourcerManager", {
    doc,
    redirectPath,
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    ...docManager,
  };
}
