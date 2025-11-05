/*****************************************************************************
 * useArrangementNotificationsFilteredBySiteOperationScheduleId ver 1.0.0
 * @author shisyamo4131
 * @description A data layer composable for arrangement notifications filtered
 *              by siteOperationScheduleId.
 *
 * @prop {string} siteOperationScheduleId - The site operation schedule ID to filter by.
 *
 * @returns {Array} docs - The array of arrangement notification documents.
 * @returns {Function} subscribe - Function to subscribe to arrangement notifications.
 * @returns {Function} unsubscribe - Function to unsubscribe from arrangement notifications.
 *****************************************************************************/
import * as Vue from "vue";
import { ArrangementNotification } from "@/schemas";

export function useArrangementNotificationsFilteredBySiteOperationScheduleId({
  siteOperationScheduleId: providedScheduleId,
} = {}) {
  /***************************************************************************
   * VALIDATIONS
   ***************************************************************************/
  validateScheduleId(providedScheduleId, true);

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new ArrangementNotification());
  const internalScheduleId = Vue.ref(providedScheduleId);

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Validate the site operation schedule ID.
   * @param {string} scheduleId - The site operation schedule ID to validate.
   * @param {boolean} allowEmpty - Whether to allow empty schedule IDs.
   * @throws {Error} If the schedule ID is invalid.
   */
  function validateScheduleId(scheduleId, allowEmpty = false) {
    if (!allowEmpty && (!scheduleId || typeof scheduleId !== "string")) {
      throw new Error(
        `siteOperationScheduleId must be a non-empty string. siteOperationScheduleId: ${scheduleId}`
      );
    }
    if (scheduleId && typeof scheduleId !== "string") {
      throw new Error(
        `siteOperationScheduleId must be a string. siteOperationScheduleId: ${scheduleId}`
      );
    }
  }

  /**
   * Subscribe to arrangement notifications filtered by site operation schedule ID.
   * @returns {void}
   */
  function _subscribe() {
    if (!internalScheduleId.value) return;
    instance.subscribeDocs({
      constraints: [
        ["where", "siteOperationScheduleId", "==", internalScheduleId.value],
      ],
    });
  }

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Subscribe to arrangement notifications filtered by site operation schedule ID.
   * @param {string} siteOperationScheduleId - The site operation schedule ID to filter by.
   * @returns {void}
   * @throws {Error} If siteOperationScheduleId is not a non-empty string.
   */
  function subscribe({ siteOperationScheduleId } = {}) {
    validateScheduleId(siteOperationScheduleId, false);
    internalScheduleId.value = siteOperationScheduleId;
  }

  /**
   * Unsubscribe from arrangement notifications.
   * @returns {void}
   */
  function unsubscribe() {
    instance.unsubscribe();
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  /**
   * Watch for changes in internalScheduleId and resubscribe accordingly.
   * Subscribe immediately if providedScheduleId is truthy.
   */
  Vue.watch(internalScheduleId, _subscribe, {
    immediate: !!providedScheduleId,
  });

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const docs = Vue.computed(() => instance.docs);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(unsubscribe);

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    docs,

    subscribe,
    unsubscribe,
  };
}
