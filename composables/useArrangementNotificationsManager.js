/*****************************************************************************
 * useArrangementNotificationsManager ver 1.0.0
 * @author shisyamo4131
 * @description A manager layer composable of arrangement notifications.
 *
 * @prop {Array} docs - The array of arrangement notification documents.
 * @prop {Array} includedKeys - The keys to include from the input props.
 *
 * @returns {Object} attrs - The attributes for the operation results manager.
 * @returns {Function} create - Function to create a new arrangement notification.
 * @returns {Function} get - Function to retrieve arrangement notifications.
 * @returns {Function} set - Function to set/update an arrangement notification.
 * @returns {Function} has - Function to check existence of an arrangement notification.
 * @returns {Object} keyMappedDocs - Key-mapped arrangement notification documents.
 * @returns {Function} isAllLeaved - Function to check if all notifications for a schedule are leaved.
 *****************************************************************************/
import * as Vue from "vue";
import { ArrangementNotification } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

export function useArrangementNotificationsManager(
  docs,
  { includedKeys = [] } = {}
) {
  /***************************************************************************
   * VALIDATIONS
   ***************************************************************************/
  if (!Vue.isRef(docs) || !Array.isArray(docs.value)) {
    throw new Error("Invalid docs parameter: must be a ref to an array");
  }

  /***************************************************************************
   * COMPOSABLES
   ***************************************************************************/
  const { error, clearError } = useLogger(
    "useArrangementNotificationsManager",
    useErrorsStore()
  );
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const component = Vue.ref(null);
  const loading = Vue.ref(false);

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  async function _update(item) {
    try {
      loading.value = true;
      const { status } = item;
      if (!Object.keys(ArrangementNotification.STATUS).includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      const handler = {
        [ArrangementNotification.STATUS.ARRANGED.key]: item.toArranged,
        [ArrangementNotification.STATUS.CONFIRMED.key]: item.toConfirmed,
        [ArrangementNotification.STATUS.ARRIVED.key]: item.toArrived,
        [ArrangementNotification.STATUS.LEAVED.key]: item.toLeaved,
      };
      const fn = handler[status];
      if (!fn) {
        throw new Error(`No handler found for status: ${status}`);
      } else {
        await fn.call(item, item);
      }
    } catch (e) {
      error({ message: e.message, error: e, data: item });
    } finally {
      loading.value = false;
    }
  }
  /***************************************************************************
   * WATCHERS
   ***************************************************************************/

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Key-mapped arrangement notification documents.
   * @returns {Object} keyMappedDocs - The arrangement notifications mapped by docId.
   */
  const keyMappedDocs = Vue.computed(() => {
    return docs.value.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  /**
   * Attributes for the ArrangementNotificationsManager component.
   * - beforeEdit: Returns true if the `editMode` is "UPDATE".
   * @returns {Object} The attributes object.
   */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      beforeEdit: (editMode, item) => {
        return editMode === "UPDATE";
      },
      disableDelete: true,
      handleUpdate: (item) => _update(item),
      inputProps: {
        includedKeys,
      },
      modelValue: docs.value,
      loading: loading.value,
      schema: ArrangementNotification,
      onError: error,
      "onError:clear": clearError,
    };
  });

  const isAllLeaved = (scheduleId) => {
    const notifications = docs.value.filter((doc) => {
      return doc.siteOperationScheduleId === scheduleId;
    });
    if (notifications.length === 0) return false;
    return notifications.every(
      (doc) => doc.status === ArrangementNotification.STATUS.LEAVED.key
    );
  };

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Create a new arrangement notification.
   * @param {Object} schedule - The schedule object containing notification details.
   */
  async function create(schedule) {
    const key = loadingsStore.add(`Creating notifications`);
    try {
      loading.value = true;
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadingsStore.remove(key);
      loading.value = false;
    }
  }

  /**
   * Retrieves a notification(s).
   * - If a string key is provided, returns the corresponding notification or null.
   * - If an object with scheduleId and optional workerId is provided, returns
   *   the matching notifications or null.
   * - If only scheduleId is provided, returns all notifications for that schedule.
   * @param {Object|String} args - The arguments object or key string.
   * @param {string} [scheduleId] - The schedule ID (optional).
   * @param {string} [workerId] - The worker ID (optional).
   * @returns {Object|Array|null}
   */
  function get(args = {}) {
    if (args && typeof args === "string") {
      return keyMappedDocs.value[args] || null;
    }
    const { scheduleId, workerId } = args;

    if (!scheduleId) {
      const message = "Invalid arguments";
      logger.error({ message, data: args });
      return null;
    }

    if (!workerId) {
      return docs.value.filter((doc) => {
        return doc.siteOperationScheduleId === scheduleId;
      });
    }

    return keyMappedDocs.value[`${scheduleId}-${workerId}`] || null;
  }

  function set(notification) {
    if (!component.value) {
      throw new Error("Component is not mounted");
    }
    if (typeof component.value.toUpdate !== "function") {
      throw new Error("toUpdate method is not available on the component");
    }
    if (!notification) {
      throw new Error("Invalid notification");
    }
    component.value.toUpdate(notification);
  }

  /**
   * Returns true if the notification exists.
   * - If key is provided, checks if the notification with that key exists.
   * - If workerId is not provided, checks if any notification exists for the scheduleId.
   * - If scheduleId and workerId are provided, checks if the specific notification exists.
   * @param {Object|String} args - The arguments object or key string.
   * @param {string} [scheduleId] - The schedule ID (optional).
   * @param {string} [workerId] - The worker ID (optional).
   * @returns {boolean}
   */
  function has(args = {}) {
    // If args is a string, treat it as key
    if (args && typeof args === "string") {
      return !!keyMappedDocs.value[key];
    }

    const { scheduleId, workerId } = args;

    // Return false if scheduleId is not provided.
    if (!scheduleId) {
      const message = "Invalid arguments";
      logger.error({ message, data: args });
      return false;
    }

    // If workerId is not provided, check if any notification exists for the scheduleId.
    if (!workerId) {
      return (
        docs.value.filter((doc) => {
          return doc.siteOperationScheduleId === scheduleId;
        }).length > 0
      );
    }

    // If both scheduleId and workerId are provided, check for the specific notification.
    return !!keyMappedDocs.value[`${scheduleId}-${workerId}`];
  }

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return { attrs, create, get, set, has, keyMappedDocs, isAllLeaved };
}
