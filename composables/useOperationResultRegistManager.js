/***************************************************************************
 * useOperationResultRegistManager
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
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

/**
 * @param {*} options
 * @param {*} options.docs - Array of SiteOperationSchedule instances to manage
 * @returns {Object} - The operation result registration manager composable
 * @returns {Array} docs - Array of SiteOperationSchedule documents
 * @returns {Object} attrs - Computed attributes for the operation result registration component
 * @returns {Object} cachedSites - Object of cached site documents
 */
export function useOperationResultRegistManager({
  docs,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /***************************************************************************
   * SETUP COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("OperationResultRegistManager", useErrorsStore());
  const loadingsStore = useLoadingsStore();

  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  const { fetchEmployee, cachedEmployees } =
    fetchEmployeeComposable || useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } =
    fetchOutsourcerComposable || useFetchOutsourcer();

  const missingComposables = [];
  if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
  if (!fetchEmployeeComposable)
    missingComposables.push("fetchEmployeeComposable");
  if (!fetchOutsourcerComposable)
    missingComposables.push("fetchOutsourcerComposable");
  if (missingComposables.length > 0) {
    console.info({
      message: `Consider providing the following composables to improve performance by caching data across multiple usages: ${missingComposables.join(
        ", "
      )}`,
    });
  }

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
   * Fetch related data for the provided documents.
   * @returns {void}
   */
  function _fetchRelatedData() {
    docs.forEach((doc) => {
      fetchSite(doc.siteId);
      fetchEmployee(doc.employeeIds);
      fetchOutsourcer(doc.outsourcerIds);
    });
  }

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
    const agreement = applicableAgreement.value;
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
  Vue.watch(docs, (newDocs) => {
    if (!Array.isArray(newDocs)) {
      throw new Error("The 'doc' parameter must be an array.");
    }
    if (!newDocs.every((doc) => doc instanceof SiteOperationSchedule)) {
      throw new Error(
        "All items in the 'doc' array must be instances of SiteOperationSchedule."
      );
    }
    _fetchRelatedData();
  });

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
    return cachedSites.value[selectedSchedule.value.siteId];
  });

  /**
   * Returns the agreement applicable to the selected schedule.
   * @returns {Object|null} The applicable agreement or null if not found.
   */
  const applicableAgreement = Vue.computed(() => {
    if (!selectedSchedule.value) return null;
    if (!site.value) return null;
    return site.value.getAgreement(selectedSchedule.value);
  });

  /**
   * Whether there is an applicable agreement for the selected schedule.
   * @returns {Boolean} True if there is an agreement, false otherwise.
   */
  const hasAgreement = Vue.computed(() => {
    if (!selectedSchedule.value) return false;
    if (!site.value) return false;
    return !!applicableAgreement.value;
  });

  /**
   * Whether the selected schedule is abled to regist as operation result.
   * @returns {Boolean} True if able to regist, false otherwise.
   */
  const isReady = Vue.computed(() => {
    if (!selectedSchedule.value) return false;
    if (!site.value) return false;
    if (!applicableAgreement.value) return false;
    if (!hasNotifications.value) return false;
    if (!isAllLeaved.value) return false;
    return true;
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
    docs: Vue.readonly(docs),
    keyMappedDocs: Vue.readonly(keyMappedDocs),

    notifications: Vue.readonly(notificationInstance.docs),
    keyMappedNotifications: Vue.readonly(keyMappedNotifications),

    site,
    applicableAgreement,
    hasAgreement,
    hasNotifications,
    isAllLeaved,
    isReady,

    attrs,

    cachedSites,
    cachedEmployees,
    cachedOutsourcers,

    notify,
  };
}
