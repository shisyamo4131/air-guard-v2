/*****************************************************************************
 * useArrangementNotificationsManager
 * @version 1.0.0
 * @author shisyamo4131
 * @description A compsable to manage ArrangementNotification instances.
 *****************************************************************************/
import * as Vue from "vue";
import { ArrangementNotification } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useFetchSite } from "./fetch/useFetchSite";
import { useFetchEmployee } from "./fetch/useFetchEmployee";
import { useFetchOutsourcer } from "./fetch/useFetchOutsourcer";

/**
 * @param {*} options
 * @param {Object} options.dateRangeComposable - An instance of useDateRange composable
 * @param {boolean} options.useDebounced - Whether to use debounced date range (default: false)
 * @param {Object} options.fetchSiteComposable - An instance of useFetchSite composable (optional)
 * @param {Object} options.fetchEmployeeComposable - An instance of useFetchEmployee composable (optional)
 * @param {Object} options.fetchOutsourcerComposable - An instance of useFetchOutsourcer composable (optional)
 * @param {boolean} options.immediate - Whether to immediately set up the subscription (default: false)
 * @returns {Object} - The arrangement notifications manager composable
 * @returns {Array} docs - Array of ArrangementNotification documents
 * @returns {Object} keyMappedDocs - Key-mapped ArrangementNotification documents
 * @returns {Object} attrs - Computed attributes for the arrangement notifications component
 * @returns {Array} cachedSites - Array of cached site documents
 * @returns {Array} cachedEmployees - Array of cached employee documents
 * @returns {Array} cachedOutsourcers - Array of cached outsourcer documents
 * @returns {Function} set - Method to set ArrangementNotification to update.
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 * @returns {Function} create - Method to create a new arrangement notification
 * @returns {Function} get - Method to retrieve notification(s)
 * @returns {Function} has - Method to check existence of notification(s)
 * @returns {Function} isAllLeaved - Method to check if all notifications for a schedule are in "LEAVED" status
 */
export function useArrangementNotificationsManager({
  dateRangeComposable,
  useDebounced = false,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  immediate = false,
} = {}) {
  /***************************************************************************
   * VALIDATIONS
   ***************************************************************************/
  if (!dateRangeComposable) {
    throw new Error("dateRangeComposable is required");
  }

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new ArrangementNotification());
  const component = Vue.ref(null);
  const loading = Vue.ref(false);
  const isReady = Vue.ref(false);

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("ArrangementNotificationsManager", useErrorsStore());
  const loadingsStore = useLoadingsStore();

  // Fetch composables
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  const { fetchEmployee, cachedEmployees } =
    fetchEmployeeComposable || useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } =
    fetchOutsourcerComposable || useFetchOutsourcer();

  if (
    !fetchSiteComposable ||
    !fetchEmployeeComposable ||
    !fetchOutsourcerComposable
  ) {
    const missingComposables = [];
    if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
    if (!fetchEmployeeComposable)
      missingComposables.push("fetchEmployeeComposable");
    if (!fetchOutsourcerComposable)
      missingComposables.push("fetchOutsourcerComposable");
    logger.info({
      message: `Consider providing the following composables to improve performance by caching data across multiple usages: ${missingComposables.join(
        ", "
      )}`,
    });
  }

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Subscribe to ArrangementNotification documents based on date range.
   * @returns {void}
   */
  function _subscribe() {
    isReady.value = false;
    const dateRange = useDebounced
      ? dateRangeComposable.debouncedDateRange.value
      : dateRangeComposable.dateRange.value;
    const { from, to } = dateRange;
    if (!from || !to) return;
    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];
    instance.subscribeDocs({ constraints }, (doc) => {
      isReady.value = true;
      fetchSite(doc.siteId);
      if (doc.isEmployee) {
        fetchEmployee(doc.id);
      } else {
        fetchOutsourcer(doc.id);
      }
    });
  }

  /** Update an existing ArrangementNotification document. */
  async function _update(item) {
    logger.clearError();
    try {
      loading.value = true;
      const { status } = item;
      if (!Object.keys(ArrangementNotification.STATUSES).includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      const handler = {
        [ArrangementNotification.STATUSES.ARRANGED.value]: item.toArranged,
        [ArrangementNotification.STATUSES.CONFIRMED.value]: item.toConfirmed,
        [ArrangementNotification.STATUSES.ARRIVED.value]: item.toArrived,
        [ArrangementNotification.STATUSES.LEAVED.value]: item.toLeaved,
      };
      const fn = handler[status];
      if (!fn) {
        throw new Error(`No handler found for status: ${status}`);
      } else {
        await fn.call(item, item);
      }
    } catch (error) {
      logger.error({ error, data: item });
    } finally {
      loading.value = false;
    }
  }

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

  function set() {
    _subscribe();
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

  const isAllLeaved = (scheduleId) => {
    const notifications = instance.docs.filter((doc) => {
      return doc.siteOperationScheduleId === scheduleId;
    });
    if (notifications.length === 0) return false;
    return notifications.every(
      (doc) => doc.status === ArrangementNotification.STATUSES.LEAVED.value
    );
  };

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  const targetDateRange = useDebounced
    ? dateRangeComposable.debouncedDateRange
    : dateRangeComposable.dateRange;
  Vue.watch(targetDateRange, _subscribe);

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Key-mapped arrangement notification documents.
   * @returns {Object} keyMappedDocs - The arrangement notifications mapped by docId.
   */
  const keyMappedDocs = Vue.computed(() => {
    return instance.docs.reduce((acc, doc) => {
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
      modelValue: instance.docs,
      schema: ArrangementNotification,
      loading: loading.value,
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  if (immediate) set();

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    docs: Vue.readonly(instance.docs),
    keyMappedDocs: Vue.readonly(keyMappedDocs),
    attrs,

    cachedSites: Vue.readonly(cachedSites),
    cachedEmployees: Vue.readonly(cachedEmployees),
    cachedOutsourcers: Vue.readonly(cachedOutsourcers),

    set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),

    create,
    get,
    has,
    isAllLeaved,
  };
}
