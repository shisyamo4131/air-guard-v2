/*****************************************************************************
 * useSiteManager
 * @version 1.0.0
 * @description A composable to manage site information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive site instance to manage
 * @param {string} options.redirectPath - Path to redirect after deletion
 * @returns {Object} - The site manager composable
 * @returns {Object} doc - Reactive site instance
 * @returns {Object} attrs - Computed attributes for the site component
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useSiteManager({
  doc = Vue.reactive(new Site()),
  redirectPath = "/sites",
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useSiteManager", {
    doc,
    redirectPath,
  });

  /** COMPUTED PROPERTIES */
  // Attributes for the component
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,
      excludedKeys: ["agreements", "status"], // 2026-01-07 Added
    };
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    ...docManager,
    attrs,
  };
}
