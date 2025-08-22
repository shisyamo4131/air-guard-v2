import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { ArrangementNotification } from "@/schemas";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import {
  ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED,
  ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED,
  ARRANGEMENT_NOTIFICATION_STATUS_LEAVED,
} from "air-guard-v2-schemas/constants";

export function useArrangementNotificationManager({ dateRange } = {}) {
  const logger = useLogger("useArrangementNotificationManager");
  const loadingsStore = useLoadingsStore();

  if (!dateRange) {
    logger.error({ message: "Date range composable is required" });
  }

  const from = Vue.computed(() => dateRange.value.from);
  const to = Vue.computed(() => dateRange.value.to);

  const instance = Vue.reactive(new ArrangementNotification());

  const docs = Vue.ref([]);

  const selectedInstance = Vue.ref(null);

  Vue.watchEffect(() => _initialize());

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

  function _getKey(scheduleId, workerId) {
    return `${scheduleId}-${workerId}`;
  }

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

  const has = (scheduleId, workerId) => {
    const key = _getKey(scheduleId, workerId);
    return !!mappedDocs.value[key];
  };

  return {
    docs,
    mappedDocs,
    get,
    create,
    has,
  };
}
