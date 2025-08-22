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

  const selectableStatus = Vue.computed(() => {
    return STATUS.ARRAY.map((item) => {
      return {
        title: item.title,
        value: item.value,
        disabled: selectedDoc.value && item.value === selectedDoc.value?.status,
      };
    });
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
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadingsStore.remove(key);
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
   * @param {string} newStatus
   */
  const update = async (newStatus) => {
    try {
      if (!STATUS.KEYS.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }
      if (!selectedDoc.value) {
        throw new Error("Notification is required");
      }
      const handler = {
        [STATUS.ARRANGED]: selectedDoc.value.toArranged,
        [STATUS.CONFIRMED]: selectedDoc.value.toConfirmed,
        [STATUS.ARRIVED]: selectedDoc.value.toArrived,
        [STATUS.LEAVED]: selectedDoc.value.toLeaved,
      };
      const fn = handler[newStatus];
      if (!fn) {
        throw new Error(`No handler found for status: ${newStatus}`);
      }
      await fn.call(selectedDoc.value);
      selectedDoc.value = null;
    } catch (error) {
      logger.error({ message: error.message, error });
    }
  };

  return {
    docs,
    mappedDocs,
    isSelected,
    selectableStatus,
    create,
    get,
    set,
    has,
    update,
  };
}
