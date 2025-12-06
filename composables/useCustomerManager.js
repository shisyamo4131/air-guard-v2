/*****************************************************************************
 * useCustomerManager
 * @version 1.0.0
 * @description A composable to manage customer information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Customer } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive customer instance to manage
 * @param {string} options.redirectPath - Path to redirect after deletion
 * @returns {Object} - The customer manager composable
 * @returns {Object} doc - Reactive customer instance
 * @returns {Object} attrs - Computed attributes for the customer component
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useCustomerManager({
  doc = Vue.reactive(new Customer()),
  redirectPath = null,
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useCustomerManager", {
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
