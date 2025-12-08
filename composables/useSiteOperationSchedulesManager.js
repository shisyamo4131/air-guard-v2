/***************************************************************************
 * useSiteOperationSchedulesManager
 * @version 1.0.0
 * @description A composable to manage SiteOperationSchedule instances
 *              within a specified date range and optional siteId.
 *              Requires a dateRange composable to function.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";

/**
 * @param {Object} options - Options for the composable
 * @param {Array<SiteOperationSchedule>} options.docs - Array of SiteOperationSchedule instances to manage
 * @returns {Object} - An object containing reactive properties and methods to manage SiteOperationSchedule instances
 * @returns {Object} returns.attrs - Attributes for the array manager component
 * @returns {Object} returns.keyMappedDocs - Computed object mapping docId to SiteOperationSchedule instances
 * @returns {Object} returns.events - Computed array of events derived from SiteOperationSchedule instances
 * @returns {Function} returns.toCreate - Method to trigger creation of a SiteOperationSchedule
 * @returns {Function} returns.toUpdate - Method to trigger update of a SiteOperationSchedule
 * @returns {Function} returns.toDelete - Method to trigger deletion of a SiteOperationSchedule
 */
export function useSiteOperationSchedulesManager({ docs, siteId } = {}) {
  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  /***************************************************************************
   * STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("SiteOperationSchedulesManager", useErrorsStore());

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const component = Vue.ref(null);

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: docs,
      schema: SiteOperationSchedule,
      beforeEdit: (editMode, item) => {
        if (siteId) item.siteId = siteId;
      },
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      disableUpdate: (item) => !!item.operationResultId,
      disableDelete: (item) => !!item.operationResultId,
      excludedKeys: ["siteId", "employees", "outsourcers"],
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /**
   * Mapped documents by their docId
   */
  const keyMappedDocs = Vue.computed(() => {
    return docs.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  /** Mapped events object */
  const events = Vue.computed(() => {
    return docs.map((doc) => doc.toEvent());
  });

  /***************************************************************************
   * RETURN OBJECT
   ***************************************************************************/
  return {
    attrs: Vue.readonly(attrs),

    keyMappedDocs: Vue.readonly(keyMappedDocs),
    events: Vue.readonly(events),

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
