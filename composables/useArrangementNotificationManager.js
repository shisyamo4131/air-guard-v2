import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { ArrangementNotification } from "@/schemas";
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
  const logger = useLogger("useArrangementNotificationManager");
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
        ["where", "dateAt", ">", from.value],
        ["where", "dateAt", "<", to.value],
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
   * Retrieves a notification by its schedule ID and worker ID.
   * - Returns null if the notification is not found.
   * @param {string} scheduleId
   * @param {string} workerId
   * @returns {Object|null}
   */
  const get = (scheduleId, workerId) => {
    const key = _getKey(scheduleId, workerId);
    const notification = mappedDocs.value[key] || null;
    return notification;
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
   * @param {string} scheduleId
   * @param {string} workerId
   * @returns {boolean}
   */
  const has = (scheduleId, workerId) => {
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
  };
}
