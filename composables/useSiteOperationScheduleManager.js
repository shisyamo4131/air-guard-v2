/***************************************************************************
 * useSiteOperationScheduleManager
 * @version 1.0.0
 * @description A composable to manage site operation schedule.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive site operation schedule instance to manage
 * @param {string} options.redirectPath - Path to redirect after deletion
 * @returns {Object} - The site operation schedule manager composable
 * @returns {Object} doc - Reactive site operation schedule instance
 * @returns {Object} attrs - Computed attributes for the `AirItemManager` component
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useSiteOperationScheduleManager({
  doc = Vue.reactive(new SiteOperationSchedule()),
  redirectPath = null,
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useSiteOperationScheduleManager", {
    doc,
    redirectPath,
  });

  return {
    ...docManager,
  };
}
