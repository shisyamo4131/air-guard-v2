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
   * Updates an existing notification's status.
   * @param {Object} args - The arguments for updating the notification.
   * @param {string} args.date - The date of the notification in YYYY-MM-DD format
   * @param {string} args.siteId - The site identifier where the notification applies
   * @param {string} args.shiftType - The type of shift (e.g., "morning", "afternoon", "night")
   * @param {string} args.employeeId - The unique identifier of the employee
   * @param {string} args.status - The new status to set. Must be one of:
   *   - ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED: Mark as arranged
   *   - ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED: Mark as confirmed
   *   - ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED: Mark as arrived
   *   - ARRANGEMENT_NOTIFICATION_STATUS_LEAVED: Mark as left/departed
   * @throws {Error} When notification is not found for the given parameters
   * @throws {Error} When an invalid status is provided
   * @returns {Promise<void>} Promise that resolves when the status update is complete
   * @example
   * await update({
   *   date: "2025-08-20",
   *   siteId: "site123",
   *   shiftType: "morning",
   *   employeeId: "emp456",
   *   status: ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED
   * });
   */
  const update = async (args) => {
    try {
      const { date, siteId, shiftType, employeeId, status } = args;
      const key = `${date}-${siteId}-${shiftType}-${employeeId}`;
      const notification = mappedDocs.value[key];
      if (!notification) throw new Error("Notification not found");
      const handler = {
        [ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED]: notification.toArranged,
        [ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED]: notification.toConfirmed,
        [ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED]: notification.toArrived,
        [ARRANGEMENT_NOTIFICATION_STATUS_LEAVED]: notification.toLeaved,
      };
      const fn = handler[status];
      if (!fn) {
        throw new Error(`Invalid status: ${status}`);
      }
      await fn.call(notification);
    } catch (error) {
      logger.error({ message: "Failed to update notification", error });
      throw error;
    }
  };

  const hasNotification = (key) => {
    return !!mappedDocs.value[key];
  };

  return {
    docs,
    mappedDocs,

    create,
    update,
    hasNotification,
  };
}
