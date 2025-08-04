/**
 * @file useSiteOperationScheduleManager.js
 * @description Composable for managing site operation schedules.
 * @param {Object} options
 * @param {Object} [options.manager] - Optional manager for handling operations.
 * @param {string} [options.siteId] - Optional site ID to filter schedules.
 * @param {Date} [options.from] - Initial start date for the schedule range.
 * @param {Date|number} [options.to] - Initial end date or number of days from start date for the schedule range.
 * @param {Object} [options.fetchEmployeeComposable] - Already created useFetchEmployee composable instance
 * @param {Object} [options.fetchOutsourcerComposable] - Already created useFetchOutsourcer composable instance
 * @param {Object} [options.fetchSiteComposable] - Already created useFetchSite composable instance
 */
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite as internalUseFetchSite } from "@/composables/fetch/useFetchSite";
import { useDateUtil } from "@/composables/useDateUtil";
import { useWorkers } from "@/composables/useWorkers";

/** Messages */
const MANAGER_NOT_PROVIDED_WARNING =
  "Manager should be provided to useSiteOperationScheduleManager.";

export function useSiteOperationScheduleManager({
  manager,
  siteId,
  from,
  to = 7,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
} = {}) {
  // Warn if manager is not provided
  if (!manager) console.warn(MANAGER_NOT_PROVIDED_WARNING);

  /** define composables */
  const employeeComposable =
    fetchEmployeeComposable || internalUseFetchEmployee();
  const outsourcerComposable =
    fetchOutsourcerComposable || internalUseFetchOutsourcer();
  const workersComposable = useWorkers({
    fetchEmployeeComposable: employeeComposable,
    fetchOutsourcerComposable: outsourcerComposable,
  });
  const { availableEmployees, availableOutsourcers, getWorkerName } =
    workersComposable;
  const { fetchEmployee, cachedEmployees } = employeeComposable;
  const { fetchOutsourcer, cachedOutsourcers } = outsourcerComposable;
  const { fetchSite, cachedSites } = fetchSiteComposable
    ? fetchSiteComposable
    : internalUseFetchSite();

  // Date utility composable
  const { validateAndProcessDateRange } = useDateUtil();

  /** define instance */
  const instance = Vue.reactive(new SiteOperationSchedule());

  /** define refs */
  const docs = Vue.ref([]); // subscribed documents

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  // Watch for changes in docs and fetch related data. (employees, outsourcers, sites)
  Vue.watch(docs, (newDocs) => fetchRelatedData(Vue.toRaw(newDocs)), {
    deep: true,
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(async () => {
    await workersComposable.initialize();
    if (from && to) initialize({ from, to });
  });

  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * Build query constraints for fetching site operation schedules.
   * @param {Object} params - Parameters for building constraints.
   * @param {Date} params.fromDate - Start date (Date object).
   * @param {Date} params.toDate - End date (Date object).
   * @param {string} [params.siteId] - Optional site ID to filter schedules.
   * @returns {Array} Array of constraint arrays for Firestore query.
   */
  const _buildConstraints = ({
    fromDate,
    toDate,
    siteId: constraintSiteId,
  }) => {
    const constraints = [
      ["where", "dateAt", ">=", fromDate],
      ["where", "dateAt", "<=", toDate],
    ];

    // Use the provided siteId parameter or fall back to the composable's siteId
    const targetSiteId = constraintSiteId || siteId;
    if (targetSiteId) {
      constraints.push(["where", "siteId", "==", targetSiteId]);
    }

    return constraints;
  };

  /**
   * Initializes the schedule manager with the specified date range.
   * @param {Object} params - Initialization parameters.
   * @param {Date} params.from - Start date of the range.
   * @param {Date|number} params.to - End date of the range or number of days from 'from' date.
   * @param {string} [params.siteId] - Optional site ID to filter schedules.
   * @returns {void}
   */
  const initialize = ({
    from: internalFrom,
    to: internalTo,
    siteId: paramSiteId,
  }) => {
    const dateRange = validateAndProcessDateRange(internalFrom, internalTo);
    if (!dateRange) return;

    const { fromDate, toDate } = dateRange;

    const constraints = _buildConstraints({
      fromDate: fromDate.toDate(),
      toDate: toDate.toDate(),
      siteId: paramSiteId,
    });

    docs.value = instance.subscribeDocs({ constraints });
  };

  /**
   * Fetch related data from the provided documents.
   * - employees, outsourcers, and sites.
   * @param {Array} newDocs
   */
  function fetchRelatedData(newDocs) {
    if (!Array.isArray(newDocs) || newDocs.length === 0) return;

    const allSites = newDocs.map((schedule) => schedule.siteId);
    if (allSites.length > 0) fetchSite(allSites);

    const allEmployees = newDocs.flatMap((schedule) => {
      const rawSchedule = Vue.toRaw(schedule);
      return Array.isArray(rawSchedule.employees) ? rawSchedule.employees : [];
    });
    if (allEmployees.length > 0) fetchEmployee(allEmployees);

    const allOutsourcers = newDocs.flatMap((schedule) => {
      const rawSchedule = Vue.toRaw(schedule);
      return Array.isArray(rawSchedule.outsourcers)
        ? rawSchedule.outsourcers
        : [];
    });
    if (allOutsourcers.length > 0) fetchOutsourcer(allOutsourcers);
  }

  /** ArrayManager configuration object */
  const arrayManagerAttrs = Vue.computed(() => ({
    modelValue: docs.value,
    schema: SiteOperationSchedule,
    beforeEdit: (editMode, item) => {
      if (siteId) item.siteId = siteId;
    },
    handleCreate: async (item) => await item.create(),
    handleUpdate: async (item) => await item.update(),
    handleDelete: async (item) => await item.delete(),
  }));

  const itemManagerAttrs = Vue.computed(() => {
    return {
      modelValue: instance,
    };
  });

  const cached = Vue.computed(() => {
    return {
      employees: cachedEmployees.value,
      outsourcers: cachedOutsourcers.value,
      sites: cachedSites.value,
    };
  });

  const workers = Vue.computed(() => {
    return {
      employees: availableEmployees.value,
      outsourcers: availableOutsourcers.value,
    };
  });

  return {
    // 念のため、使用しているコンポーザブル自体も返す
    workersComposable,

    // DATA
    cached,
    docs,
    schema: SiteOperationSchedule,
    instance,
    workers,

    // Attributes for manager component.
    arrayManagerAttrs,
    itemManagerAttrs,

    // statistics
    statistics: workersComposable.statistics,

    // METHODS
    initialize,
    getWorkerName,
    toCreate: () => manager?.value?.toCreate?.(),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
