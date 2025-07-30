/**
 * @file useSiteOperationScheduleManager.js
 * @description Composable for managing site operation schedules.
 */
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/useFetchOutsourcer";
import { useFetchSite as internalUseFetchSite } from "@/composables/useFetchSite";
import { useDateUtil } from "@/composables/useDateUtil";

/** Messages */
const MANAGER_NOT_PROVIDED_WARNING =
  "Manager should be provided to useSiteOperationScheduleManager.";

/**
 * @param {Object} options
 * @param {Object} [options.manager] - Optional manager for handling operations.
 * @param {string} [options.siteId] - Optional site ID to filter schedules.
 * @param {Date} [options.from] - Initial start date for the schedule range.
 * @param {number} [options.days=7] - Number of days from start date for the initial range.
 * @param {Function} [options.useFetchEmployee] - Custom useFetchEmployee composable
 * @param {Function} [options.useFetchOutsourcer] - Custom useFetchOutsourcer composable
 * @param {Function} [options.useFetchSite] - Custom useFetchSite composable
 */
export function useSiteOperationScheduleManager({
  manager,
  siteId,
  from,
  days = 7,
  useFetchEmployee,
  useFetchOutsourcer,
  useFetchSite,
} = {}) {
  // Warn if manager is not provided
  if (!manager) console.warn(MANAGER_NOT_PROVIDED_WARNING);

  /** define composables */
  // Use provided composables if it specified, otherwise use internal ones.
  const { fetchEmployee, cachedEmployees } = useFetchEmployee
    ? useFetchEmployee()
    : internalUseFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } = useFetchOutsourcer
    ? useFetchOutsourcer()
    : internalUseFetchOutsourcer();
  const { fetchSite, cachedSites } = useFetchSite
    ? useFetchSite()
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
  Vue.onMounted(() => {
    if (!from || !days) return;
    initialize({ from, to: days });
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

  return {
    cachedEmployees,
    cachedOutsourcers,
    cachedSites,
    docs,
    schema: SiteOperationSchedule,
    instance,
    initialize,
    arrayManagerAttrs,
    itemManagerAttrs,
    toCreate: () => manager?.value?.toCreate?.(),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
