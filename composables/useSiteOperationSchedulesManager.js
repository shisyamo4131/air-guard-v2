/**
 * @file useSiteOperationSchedulesManager.js
 * @description Composable for managing site operation schedules.
 * @param {Object} options - Configuration options.
 * @param {Object} [options.manager] - Manager instance for schedule operations.
 * @param {string} [options.siteId] - Site ID to filter schedules.
 * @param {Date} [options.from] - Start date for the schedule range.
 * @param {Date|number} [options.to] - End date (Date) or number of days from start date (number).
 * @param {Object} [options.fetchEmployeeComposable] - Custom composable for fetching employees.
 * @param {Object} [options.fetchOutsourcerComposable] - Custom composable for fetching outsourcers.
 * @param {Object} [options.fetchSiteComposable] - Custom composable for fetching sites.
 */
import * as Vue from "vue";
import { useNuxtApp } from "#app";
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite as internalUseFetchSite } from "@/composables/fetch/useFetchSite";
import { useDateRange } from "@/composables/useDateRange";
import { runTransaction } from "firebase/firestore";

/** Messages */
const MANAGER_NOT_PROVIDED_WARNING =
  "Manager should be provided to useSiteOperationSchedulesManager.";

// Default number of days for the schedule range if 'to' is not provided.
const DEFAULT_FROM = dayjs().startOf("day").toDate();
const DEFAULT_DAYS_COUNT = 7;

export function useSiteOperationSchedulesManager({
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

  // Local documents for optimistic updates.
  const localDocs = Vue.ref([]);

  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  /**
   * useDateRange
   * - Initialize with providedFrom and providedTo.
   * - If providedTo is a number, it will be treated as the number of days
   */
  const initFrom = providedFrom || dayjs().startOf("day").toDate();
  const initTo =
    typeof providedTo === "number"
      ? dayjs(initFrom).add(providedTo, "day").toDate()
      : providedTo;
  const dateRangeComposable = useDateRange({
    baseDate: providedFrom || dayjs().startOf("day").toDate(),
    dayCount: dayjs(initTo).diff(dayjs(initFrom), "day"),
  });

  /**
   * useFetchEmployee & useFetchOutsourcer
   * - If provided, use it; otherwise, use the internal fetchEmployee composable.
   */
  const employeeComposable =
    fetchEmployeeComposable || internalUseFetchEmployee();
  const { fetchEmployee, cachedEmployees, employeesMap } = employeeComposable;

  const outsourcerComposable =
    fetchOutsourcerComposable || internalUseFetchOutsourcer();
  const { fetchOutsourcer, cachedOutsourcers, outsourcersMap } =
    outsourcerComposable;

  /**
   * useFetchSite
   * - If provided, use it; otherwise, use the internal fetchSite composable.
   */
  const siteComposable = fetchSiteComposable || internalUseFetchSite();
  const { fetchSite, cachedSites, sitesMap } = siteComposable;

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  /**
   * Watches the `docs` array for changes and fetches related data.
   */
  Vue.watch(
    docs,
    (newDocs) => {
      _fetchRelatedData(Vue.toRaw(newDocs));
      // docsの変更をlocalDocsに同期
      if (newDocs && Array.isArray(newDocs)) {
        localDocs.value = [...newDocs].sort((a, b) => {
          // displayOrderが未定義の場合は0として扱う
          const orderA = a.displayOrder ?? 0;
          const orderB = b.displayOrder ?? 0;

          // 数値として比較
          return orderA - orderB;
        });
      }
    },
    {
      deep: true,
      immediate: true,
    }
  );

  Vue.watch(
    () => dateRangeComposable.debouncedDateRange.value,
    (newRange) => !newRange || _initialize()
  );

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(async () => {
    // Initialize this composable.
    _initialize();
  });

  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * METHODS
   ***************************************************************************/

  /**
   * Replaces the schedules specified by siteId, shiftType, and date to the new schedules.
   * For optimistic update, `localDocs` will be updated immediately.
   * @param {Array} newSchedules - New schedules array for the cell
   * @param {string} siteId - Site ID
   * @param {string} shiftType - Shift type
   * @param {string} date - Date (YYYY-MM-DD format)
   */
  const replaceDocs = async (newSchedules, siteId, shiftType, date) => {
    // Filter out schedules that match the specified siteId, shiftType, and date
    const filteredSchedules = localDocs.value.filter((schedule) => {
      return !(
        schedule.siteId === siteId &&
        schedule.shiftType === shiftType &&
        schedule.date === date
      );
    });

    const newDateAt = new Date(date);
    newDateAt.setUTCHours(0, 0, 0, 0);
    newSchedules.forEach((schedule, index) => {
      schedule.dateAt = newDateAt;
      schedule.displayOrder = index;
    });

    // Replace localDocs with the new schedules
    localDocs.value = [...filteredSchedules, ...newSchedules];

    // Update Firestore documents.
    const { $firestore } = useNuxtApp();
    await runTransaction($firestore, async (transaction) => {
      await Promise.all(
        newSchedules.map((schedule) => schedule.update({ transaction }))
      );
    });
  };

  /**
   * Gets the display name of a worker by their ID.
   * @param {Object} param0 - The parameters.
   * @param {string} param0.workerId - The ID of the worker.
   * @param {boolean} param0.isEmployee - Whether the worker is an employee.
   * @returns {string|null} The display name of the worker or null if not found.
   */
  const getWorkerName = ({ workerId, isEmployee }) => {
    if (isEmployee) {
      return employeesMap.value[workerId]?.displayName || null;
    } else {
      return outsourcersMap.value[workerId]?.displayName || null;
    }
  };

  /***************************************************************************
   * PRIVATE METHODS
   ***************************************************************************/
  /**
   * Initializes the schedule manager with the specified date range.
   * @param {Object} params - Initialization parameters.
   * @param {string} [params.siteId] - site ID to filter schedules. (optional)
   * @returns {void}
   */
  const _initialize = ({ siteId: paramSiteId } = {}) => {
    // Build constraints for fetching schedules.
    const constraints = _buildConstraints({
      fromDate: dateRangeComposable.startDate.value,
      toDate: dateRangeComposable.endDate.value,
      siteId: paramSiteId,
    });

    docs.value = instance.subscribeDocs({ constraints });
  };
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
      dialogProps: {
        maxWidth: 600,
      },
      inputProps: {
        excludedKeys: ["status", "employees", "outsourcers"],
      },
    };
  });

  /** Configuration object for calendar component. */
  const calendarAttrs = Vue.computed(() => {
    const onUpdateModelValue = (date) => {
      const from = dayjs(date).startOf("month").toDate();
      const to = dayjs(date).endOf("month").toDate();
      dateRangeComposable.dateRange.value = { from, to };
    };
    const events = docs.value.map((schedule) => schedule.toEvent());
    return {
      modelValue: [dateRangeComposable.currentBaseDate.value],
      "onUpdate:modelValue": onUpdateModelValue,
      events,
      "onClick:event": ($event) => manager?.value?.toUpdate?.($event.item),
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

  /** date range */
  const dateRange = Vue.computed({
    get: () => dateRangeComposable.dateRange.value,
    set: (value) => (dateRangeComposable.dateRange.value = value),
  });

  /** day count */
  const dayCount = Vue.computed({
    get: () => dateRangeComposable.dateRange.value.dayCount,
    set: (value) => dateRangeComposable.setDayCount(value),
  });

  /**
   * Returns a map of schedules grouped by siteId, shiftType, and date.
   * This is useful for quickly accessing schedules for a specific cell in the calendar or table.
   */
  const keyMappedDocs = Vue.computed(() => {
    const result = localDocs.value.reduce((acc, schedule) => {
      const key = `${schedule.siteId}-${schedule.shiftType}-${schedule.date}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(schedule);
      return acc;
    }, {});

    return result;
  });

  const statistics = Vue.computed(() => {
    const from = dateRangeComposable.startDate.value;
    const to = dateRangeComposable.endDate.value;
    const dayCount = dateRangeComposable.currentDayCount.value;
    const requiredPersonnel = {};

    for (let i = 0; i < dayCount; i++) {
      const dateStr = dayjs(from).add(i, "day").format("YYYY-MM-DD");
      requiredPersonnel[dateStr] = localDocs.value
        .filter((schedule) => schedule.date === dateStr)
        .reduce((sum, schedule) => sum + (schedule.requiredPersonnel || 0), 0);
    }

    return { from, to, dayCount, requiredPersonnel };
  });

  return {
    // DATA
    cachedData: Vue.readonly(cached),
    docs: localDocs,
    dayCount,
    dateRange,
    statistics,

    // Mapped schedules grouped by key (siteId-shiftType-date).
    keyMappedDocs: keyMappedDocs,

    // Attributes for manager component.
    arrayManagerAttrs,
    itemManagerAttrs,
    calendarAttrs,

    // METHODS
    getWorkerName,
    replaceDocs,
    setFrom: dateRangeComposable.setBaseDate,

    // Methods for managing schedules provided by the manager.
    toCreate: () => manager?.value?.toCreate?.(),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
