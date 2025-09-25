import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { ArrangementNotification } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import {
  ARRANGEMENT_NOTIFICATION_STATUS,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRAY,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED,
  ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED,
  ARRANGEMENT_NOTIFICATION_STATUS_LEAVED,
} from "air-guard-v2-schemas/constants";

const STATUS = {
  KEYS: Object.keys(ARRANGEMENT_NOTIFICATION_STATUS),
  ARRAY: ARRANGEMENT_NOTIFICATION_STATUS_ARRAY,
  ARRANGED: ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED,
  CONFIRMED: ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED,
  ARRIVED: ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED,
  LEAVED: ARRANGEMENT_NOTIFICATION_STATUS_LEAVED,
};

export function useArrangementNotificationManager({ dateRange } = {}) {
  const logger = useLogger(
    "useArrangementNotificationManager",
    useErrorsStore()
  );
  const loadingsStore = useLoadingsStore();

  if (!dateRange) {
    logger.error({ message: "Date range composable is required" });
  }

  const instance = Vue.reactive(new ArrangementNotification());

  /*****************************************************************************
   * DEFINE REFS
   *****************************************************************************/
  const from = Vue.computed(() => dateRange.value.from);
  const to = Vue.computed(() => dateRange.value.to);
  const docs = Vue.ref([]);
  const selectedDoc = Vue.ref(null); // Whether a notification instance is selected.
  const isLoading = Vue.ref(false);

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watchEffect(() => _initialize());

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  function _initialize() {
    docs.value = instance.subscribeDocs({
      constraints: [
        ["where", "dateAt", ">=", from.value],
        ["where", "dateAt", "<=", to.value],
      ],
    });
  }

  const mappedDocs = Vue.computed(() => {
    return docs.value.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  const isSelected = Vue.computed(() => {
    return !!selectedDoc.value;
  });

  const attrs = Vue.computed(() => {
    return {
      modelValue: !!selectedDoc.value,
      actualStartTime: selectedDoc.value?.actualStartTime,
      actualEndTime: selectedDoc.value?.actualEndTime,
      actualBreakMinutes: selectedDoc.value?.actualBreakMinutes,
      loading: isLoading.value,
      status: selectedDoc.value?.status,
      "onUpdate:model-value": set,
      "onClick:submit": update,
      "onClick:cancel": set,
    };
  });

  /*****************************************************************************
   * PRIVATE METHODS
   *****************************************************************************/
  function _getKey(scheduleId, workerId) {
    return `${scheduleId}-${workerId}`;
  }

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  const create = async (schedule) => {
    const key = loadingsStore.add(`Creating notifications`);
    try {
      isLoading.value = true;
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadingsStore.remove(key);
      isLoading.value = false;
    }
  };

  /**
   * Retrieves a notification(s).
   * @param {Object|String} args - The arguments object or key string.
   * @param {string} [scheduleId] - The schedule ID (optional).
   * @param {string} [workerId] - The worker ID (optional).
   * @returns {Object|Array|null}
   */
  const get = (args = {}) => {
    if (args && typeof args === "string") {
      return mappedDocs.value[args] || null;
    }
    const { scheduleId, workerId } = args;

    if (!scheduleId) {
      logger.error({
        message: "Invalid arguments",
        data: args,
      });
      return null;
    }

    if (!workerId) {
      return docs.value.filter((doc) => {
        return doc.siteOperationScheduleId === scheduleId;
      });
    }

    const key = _getKey(scheduleId, workerId);
    return mappedDocs.value[key] || null;
  };

  /**
   * Sets the selected notification.
   * - If the argument is an object with scheduleId and workerId, it retrieves the notification.
   * - If the argument is null or undefined, it clears the selection.
   * @param {Object} arg - The notification object or identifier.
   */
  const set = (arg) => {
    try {
      if (!arg) {
        selectedDoc.value = null;
        return;
      }
      if (typeof arg === "object" && arg.scheduleId && arg.workerId) {
        selectedDoc.value = get(arg.scheduleId, arg.workerId);
      } else {
        selectedDoc.value = Vue.toRaw(arg);
      }
    } catch (error) {
      logger.error({ message: "Failed to set notification", error, data: arg });
    }
  };

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
  const has = (args = {}) => {
    // If args is a string, treat it as key
    if (args && typeof args === "string") {
      return !!mappedDocs.value[key];
    }

    const { scheduleId, workerId } = args;

    // Return false if scheduleId is not provided.
    if (!scheduleId) {
      logger.error({
        message: "Invalid arguments",
        data: args,
      });
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
    const key = _getKey(scheduleId, workerId);
    return !!mappedDocs.value[key];
  };

  /**
   * Updates the status of the selected notification.
   * @param {Object} options - The options for updating the notification.
   * @param {string} options.actualStartTime - The actual start time.
   * @param {string} options.actualEndTime - The actual end time.
   * @param {number} options.actualBreakMinutes - The actual break minutes.
   * @param {string} options.status - The new status.
   */
  const update = async (options) => {
    try {
      isLoading.value = true;
      const { status } = options;
      if (!selectedDoc.value) {
        throw new Error("Invalid action. Notification is not selected.");
      }
      if (!STATUS.KEYS.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      const handler = {
        [STATUS.ARRANGED]: selectedDoc.value.toArranged,
        [STATUS.CONFIRMED]: selectedDoc.value.toConfirmed,
        [STATUS.ARRIVED]: selectedDoc.value.toArrived,
        [STATUS.LEAVED]: selectedDoc.value.toLeaved,
      };
      const fn = handler[status];
      if (!fn) {
        throw new Error(`No handler found for status: ${status}`);
      } else if (status === STATUS.LEAVED) {
        await fn.call(selectedDoc.value, options);
      } else {
        await fn.call(selectedDoc.value);
      }
      selectedDoc.value = null;
    } catch (error) {
      logger.error({ message: error.message, error, data: options });
    } finally {
      isLoading.value = false;
    }
  };

  const isAllLeaved = (scheduleId) => {
    const notifications = docs.value.filter((doc) => {
      return doc.siteOperationScheduleId === scheduleId;
    });
    if (notifications.length === 0) return false;
    return notifications.every((doc) => doc.status === STATUS.LEAVED);
  };

  return {
    docs,
    mappedDocs,
    isSelected,
    attrs,
    loading: isLoading,
    create,
    get,
    set,
    has,
    update,
    isAllLeaved,
  };
}
