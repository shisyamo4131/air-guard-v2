/*****************************************************************************
 * useArrangementNotificationsForStatusUpdater ver 1.0.0
 * @author shisyamo4131
 * @description A data layer composable for arrangement notifications status updater.
 *
 * @returns {Array} docs - The array of arrangement notification documents.
 * @returns {Function} subscribe - Function to subscribe to arrangement notifications.
 * @returns {Function} unsubscribe - Function to unsubscribe from arrangement notifications.
 *****************************************************************************/
import * as Vue from "vue";
import { ArrangementNotification } from "@/schemas";

export function useArrangementNotificationsForStatusUpdater() {
  /***************************************************************************
   * VALIDATIONS
   ***************************************************************************/

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = reactive(new ArrangementNotification());

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Subscribe to arrangement notifications within the date range.
   * @returns {void}
   */
  function subscribe(siteOperationScheduleId) {
    if (!siteOperationScheduleId) {
      throw new Error("siteOperationScheduleId is required");
    }
    instance.subscribeDocs({
      constraints: [
        ["where", "siteOperationScheduleId", "==", siteOperationScheduleId],
      ],
    });
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
