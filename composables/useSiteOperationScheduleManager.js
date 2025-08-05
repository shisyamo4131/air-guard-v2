/**
 * @file useSiteOperationScheduleManager.js
 * @description Composable for managing site operation schedules.
 * @param {Object} options - Configuration options.
 * @param {Object} [options.manager] - Manager instance for schedule operations.
 * @param {string} [options.siteId] - Site ID to filter schedules.
 * @param {Date} [options.from] - Start date for the schedule range.
 * @param {Date|number} [options.to] - End date or number of days from the start date.
 * @param {Object} [options.fetchEmployeeComposable] - Custom useFetchEmployee composable instance.
 * @param {Object} [options.fetchOutsourcerComposable] - Custom useFetchOutsourcer composable instance.
 * @param {Object} [options.fetchSiteComposable] - Custom useFetchSite composable instance.
 */
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite as internalUseFetchSite } from "@/composables/fetch/useFetchSite";
import { useDateUtil } from "@/composables/useDateUtil";
import { useWorkers } from "@/composables/useWorkers";
import dayjs from "dayjs";

/** Messages */
const MANAGER_NOT_PROVIDED_WARNING =
  "Manager should be provided to useSiteOperationScheduleManager.";

// Default number of days for the schedule range if 'to' is not provided.
const DEFAULT_FROM = dayjs().startOf("day").toDate();
const DEFAULT_DAYS_COUNT = 7;

export function useSiteOperationScheduleManager({
  manager,
  siteId,
  from: providedFrom = DEFAULT_FROM,
  to: providedTo = DEFAULT_DAYS_COUNT,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
} = {}) {
  // Warn if manager is not provided
  if (!manager) console.warn(MANAGER_NOT_PROVIDED_WARNING);

  // Throw an error if providedFrom is provided and not a Date object.
  if (!(providedFrom instanceof Date)) {
    throw new Error("Provided 'from' must be a Date object.");
  }

  // Throw an error if providedTo is provided and not a Date object or a number.
  if (!(providedTo instanceof Date || typeof providedTo === "number")) {
    throw new Error("Provided 'to' must be a Date object or a number of days.");
  }

  /** define instance & refs */
  const instance = Vue.reactive(new SiteOperationSchedule());
  const docs = Vue.ref([]); // subscribed documents.
  const currentFrom = Vue.ref(providedFrom || dayjs().startOf("day").toDate()); // Start date for the schedule range.
  // const currentTo = Vue.ref(providedTo || DEFAULT_DAYS_COUNT); // End date or number of days from the start date.
  const currentTo = Vue.ref(
    typeof providedTo === "number"
      ? dayjs(currentFrom.value).add(providedTo, "day").toDate()
      : providedTo
  );

  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  /**
   * useFetchEmployee & useFetchOutsourcer
   * - If provided, use it; otherwise, use the internal fetchEmployee composable.
   */
  const employeeComposable =
    fetchEmployeeComposable || internalUseFetchEmployee();
  const { fetchEmployee, cachedEmployees } = employeeComposable;

  const outsourcerComposable =
    fetchOutsourcerComposable || internalUseFetchOutsourcer();
  const { fetchOutsourcer, cachedOutsourcers } = outsourcerComposable;

  /**
   * useWorkers
   * - Provides fetchEmployee and fetchOutsourcer composables.
   */
  const workersComposable = useWorkers({
    fetchEmployeeComposable: employeeComposable,
    fetchOutsourcerComposable: outsourcerComposable,
  });
  const { availableEmployees, availableOutsourcers, getWorkerName } =
    workersComposable;

  /**
   * useFetchSite
   * - If provided, use it; otherwise, use the internal fetchSite composable.
   */
  const siteComposable = fetchSiteComposable || internalUseFetchSite();
  const { fetchSite, cachedSites } = siteComposable;

  /**
   * useDateUtil
   */
  const { validateAndProcessDateRange } = useDateUtil();

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  /**
   * Watches the `docs` array for changes and fetches related data.
   * - When `docs` changes, it triggers `_fetchRelatedData` to update employees,
   *   outsourcers, and sites based on the new documents.
   */
  Vue.watch(docs, (newDocs) => _fetchRelatedData(Vue.toRaw(newDocs)), {
    deep: true,
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(async () => {
    // Initialize the workers to ensure employees and outsourcers are ready.
    await workersComposable.initialize();

    // Initialize this composable.
    initialize();
  });

  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * Initializes the schedule manager with the specified date range.
   * @param {Object} params - Initialization parameters.
   * @param {Date} [params.from] - Start date of the range. (optional)
   * @param {Date|number} [params.to] - End date of the range or number of days from 'from' date. (optional)
   * @param {string} [params.siteId] - site ID to filter schedules. (optional)
   * @returns {void}
   */
  const initialize = ({
    from: internalFrom,
    to: internalTo,
    siteId: paramSiteId,
  } = {}) => {
    // Throw an error if internalFrom is provided and not a Date object.
    if (internalFrom && !(internalFrom instanceof Date)) {
      throw new Error("Provided 'from' must be a Date object.");
    }

    // Throw an error if internalTo is provided and not a Date object or a number.
    if (
      internalTo &&
      !(internalTo instanceof Date || typeof internalTo === "number")
    ) {
      throw new Error(
        "Provided 'to' must be a Date object or a number of days."
      );
    }

    // Set the currentFrom and currentTo values based on provided parameters.
    if (internalFrom) currentFrom.value = internalFrom;
    if (internalTo) currentTo.value = internalTo;

    // Get the date range based on currentFrom and currentTo.
    const newDateRange = validateAndProcessDateRange(
      currentFrom.value,
      currentTo.value
    );
    if (!newDateRange) return;

    const { fromDate, toDate } = newDateRange;

    // Build constraints for fetching schedules.
    const constraints = _buildConstraints({
      fromDate: fromDate.toDate(),
      toDate: toDate.toDate(),
      siteId: paramSiteId,
    });

    docs.value = instance.subscribeDocs({ constraints });
  };

  /***************************************************************************
   * PRIVATE METHODS
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
   * Fetch related data from the provided documents.
   * - employees, outsourcers, and sites.
   * @param {Array} newDocs
   */
  function _fetchRelatedData(newDocs) {
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

  /***************************************************************************
   * COMPUTED PROPERTIES FOR PROVIDE
   ***************************************************************************/
  /** Configuration object for ArrayManager. */
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

  /** Configuration object for ItemManager. */
  const itemManagerAttrs = Vue.computed(() => {
    return {
      modelValue: instance,
    };
  });

  /** Cached data for employees, outsourcers, and sites. */
  const cached = Vue.computed(() => {
    return {
      employees: cachedEmployees.value,
      outsourcers: cachedOutsourcers.value,
      sites: cachedSites.value,
    };
  });

  /** Computed property for workers, combining employees and outsourcers. */
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

    // STATE
    currentFrom: Vue.readonly(currentFrom),
    currentTo: Vue.readonly(currentTo),

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
