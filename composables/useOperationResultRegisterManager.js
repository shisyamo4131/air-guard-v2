/***************************************************************************
 * useOperationResultRegisterManager
 * @version 1.0.0
 * @description A composable to manage the registration of operation results
 *              for SiteOperationSchedule instances.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { ArrangementNotification } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";

/**
 * @param {*} options
 * @param {*} options.docs - Array of SiteOperationSchedule instances to manage
 * @param {*} options.cachedSites - Object of cached site documents
 * @returns {Object} - The operation result registration manager composable
 * @returns {Object} - keyMappedDocs: Key-mapped SiteOperationSchedule documents
 * @returns {Array} - notifications: Array of ArrangementNotification documents
 * @returns {Object} - keyMappedNotifications: Key-mapped ArrangementNotification documents
 * @returns {Boolean} - hasNotifications: Whether all workers have notifications
 * @returns {Function} - getNotification: Function to get a notification by its key
 * @returns {Object} - site: The site instance associated with the selected schedule
 * @returns {Object} - agreement: The agreement applicable to the selected schedule
 * @returns {Boolean} - hasAgreement: Whether there is an applicable agreement
 * @returns {Boolean} - isAllLeaved: Whether all workers have left
 * @returns {Boolean} - isReady: Whether the selected schedule is ready to be registered as operation result
 * @returns {Object} - attrs: Attributes for the component
 * @returns {Function} - notify: Function to create notifications for the selected schedule
 */
export function useOperationResultRegisterManager({ docs, cachedSites } = {}) {
  /***************************************************************************
   * SETUP COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("OperationResultRegisterManager", useErrorsStore());
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const component = Vue.ref(null);
  const notificationInstance = Vue.reactive(new ArrangementNotification());
  const selectedSchedule = Vue.ref(null);

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Subscribe notifications related to a specific schedule ID.
   * NOTE: 画像データなどを取得する可能性があるため、非同期処理で実装。
   * @param {String} scheduleId - The ID of the schedule to get notifications for.
   * @returns {Promise<void>}
   */
  async function _subscribeNotifications(scheduleId) {
    const loadingsKey = loadingsStore.add("配置通知を取得中...");
    try {
      await notificationInstance.subscribeDocs({
        constraints: [["where", "siteOperationScheduleId", "==", scheduleId]],
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      logger.error({ error });
    } finally {
      loadingsStore.remove(loadingsKey);
    }
  }

  async function _submit() {
    if (!selectedSchedule.value) {
      logger.error({ message: "No schedule selected for submission." });
      return;
    }
    if (!site.value) {
      const message = `Site with ID ${selectedSchedule.value.siteId} not found in cache. Attempting to fetch.`;
      logger.error({ message });
      return;
    }
    const agreement = agreement.value;
    if (!agreement) {
      const message = `No agreement found for schedule ID ${selectedSchedule.value.docId} on site ID ${site.docId}.`;
      logger.error({ message });
      return;
    }
    const loadingsKey = loadingsStore.add("稼働実績として登録中...");
    try {
      await selectedSchedule.value.syncToOperationResult(
        agreement,
        keyMappedNotifications.value
      );
    } catch (error) {
      logger.error({ error });
    } finally {
      loadingsStore.remove(loadingsKey);
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Create notifications for the selected schedule.
   * @returns {Promise<void>}
   */
  async function notify() {
    if (!selectedSchedule.value) {
      logger.error({ message: "No schedule selected for notification." });
      return;
    }
    const loadingsKey = loadingsStore.add("配置通知を作成中...");
    try {
      await selectedSchedule.value.notify();
    } catch (error) {
      logger.error({ error });
    } finally {
      loadingsStore.remove(loadingsKey);
    }
  }

  /**
   * Retrieve a notification by its key.
   * @param {string} notificationKey
   * @returns {Object|null} The notification object or null if not found.
   */
  function getNotification(notificationKey) {
    return keyMappedNotifications.value[notificationKey] || null;
  }

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    notificationInstance.unsubscribe();
  });

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Key-mapped documents for quick access.
   * @returns {Object} Key-mapped SiteOperationSchedule documents.
   */
  const keyMappedDocs = Vue.computed(() => {
    return docs.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  /**
   * Key-mapped notifications for quick access.
   * @returns {Object} Key-mapped ArrangementNotification documents.
   */
  const keyMappedNotifications = Vue.computed(() => {
    return notificationInstance.docs.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  /**
   * Whether all workers have received notifications.
   * @returns {Boolean} True if all workers have notifications, false otherwise.
   */
  const hasNotifications = Vue.computed(() => {
    if (!selectedSchedule.value) return false;
    if (selectedSchedule.value.workers.length === 0) return true;
    const notificationsCount = notificationInstance.docs.length;
    const workersCount = selectedSchedule.value.workers.length;
    return notificationsCount === workersCount;
  });

  /**
   * Whether all workers have left.
   * @returns {Boolean} True if all workers have left, false otherwise.
   */
  const isAllLeaved = Vue.computed(() => {
    if (!selectedSchedule.value) return false;
    return notificationInstance.docs.every((doc) => doc.isLeaved === true);
  });

  /**
   * Returns the site instance associated with the selected schedule.
   * @returns {Object|null} The site instance or null if not found.
   */
  const site = Vue.computed(() => {
    if (!selectedSchedule.value) return null;
    return cachedSites?.value?.[selectedSchedule.value.siteId];
  });

  /**
   * Returns the agreement applicable to the selected schedule.
   * @returns {Object|null} The applicable agreement or null if not found.
   */
  const agreement = Vue.computed(() => {
    if (!selectedSchedule.value) return null;
    if (!site.value) return null;
    return site.value.getAgreement(selectedSchedule.value);
  });

  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: docs,
      schema: SiteOperationSchedule,
      beforeEdit: async (editMode, item) => {
        selectedSchedule.value = item;
        await _subscribeNotifications(item.docId);
        return true;
      },
      handleUpdate: _submit,
      dialogProps: { maxWidth: "840" },
      tableProps: { hideSearch: true },
      hideDeleteBtn: true,
      hideSearch: true,
      label: "稼働実績登録",
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
      "onSubmit:complete": () => (selectedSchedule.value = null),
      onQuit: () => (selectedSchedule.value = null),
    };
  });

  /***************************************************************************
   * RETURN OBJECT
   ***************************************************************************/
  return {
    keyMappedDocs: Vue.readonly(keyMappedDocs),

    // notifications
    notifications: Vue.readonly(notificationInstance.docs),
    keyMappedNotifications: Vue.readonly(keyMappedNotifications),
    hasNotifications,
    getNotification,

    agreement,
    isAllLeaved,

    attrs,

    notify,
  };
}
