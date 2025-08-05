/**
 * @file useSiteOperationScheduleManager.js
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
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite as internalUseFetchSite } from "@/composables/fetch/useFetchSite";
import { useWorkers } from "@/composables/useWorkers";
import { useDateRange } from "@/composables/useDateRange";
import { useDebouncedRef } from "@/composables/usePerformanceOptimization";
import { DAY_TYPE_HOLIDAY, getDayType } from "air-guard-v2-schemas/constants";

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

  /** デバウンス機能付きの日付範囲 */
  const debouncedDateRangeComposable = useDebouncedRef(
    dateRangeComposable.dateRange.value,
    500
  );

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

  /**
   * Watches the date range and updates the debounced date range.
   * - This ensures that the debounced date range is updated whenever the
   *   original date range changes.
   */
  Vue.watch(
    () => dateRangeComposable.dateRange.value,
    (newRange) => {
      debouncedDateRangeComposable.value.value = newRange;
    }
  );

  Vue.watch(
    () => debouncedDateRangeComposable.debouncedValue.value,
    (newRange) => !newRange || _initialize()
  );

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(async () => {
    // Initialize the workers to ensure employees and outsourcers are ready.
    await workersComposable.initialize();

    // Initialize this composable.
    _initialize();
  });

  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * METHODS
   ***************************************************************************/

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

  /**
   * Returns the styles for a specific date column.
   * @param {Date} dateAt
   * @returns {Object} Computed styles for the date column.
   */
  function _getColumnStyles(dateAt) {
    const today = dayjs().startOf("day");
    const targetDay = dayjs(dateAt).locale("en");
    const dayOfWeek = targetDay.format("ddd").toLowerCase();
    const isPreviousDay = targetDay.isBefore(today);
    const isToday = targetDay.isSame(today);
    const isFutureDay = targetDay.isAfter(today);
    const isHoliday = getDayType(targetDay.toDate()) === DAY_TYPE_HOLIDAY;
    const dateLabel = targetDay.format("MM/DD");
    const dayOfWeekJp = targetDay.locale("ja").format("ddd").toLowerCase();
    const cssClasses = {
      "g-col": true,
      [`g-col-${dayOfWeek}`]: true,
      "g-col-previous": isPreviousDay,
      "g-col-today": isToday,
      "g-col-future": isFutureDay,
      "g-col-holiday": isHoliday,
    };
    return {
      targetDay,
      dayOfWeek,
      dateComparison: { isPreviousDay, isToday, isFutureDay },
      isHoliday,
      dateLabel,
      dayOfWeekJp,
      cssClasses,
    };
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

  /**
   * Columns for the schedule table.
   */
  const columns = Vue.computed(() => {
    const baseDate = dayjs(dateRangeComposable.startDate.value);
    const resolvedDayCount = dateRangeComposable.dateRange.value.dayCount;
    const resolvedSchedules = docs.value;

    // Initialize result array
    const result = [];

    for (let i = 0; i < resolvedDayCount; i++) {
      const date = baseDate.add(i, "day");
      const dateAt = date.toDate();

      // Get styles for the column
      const columnStyles = _getColumnStyles(dateAt);

      // Calculate total required personnel for the day
      const requiredPersonnelTotal = resolvedSchedules
        .filter((schedule) => {
          if (!schedule?.date) return false;
          return dayjs(schedule.date).isSame(date, "day");
        })
        .reduce((total, schedule) => {
          const required = schedule?.requiredPersonnel || 0;
          return total + (typeof required === "number" ? required : 0);
        }, 0);

      result.push({
        date: date.format("YYYY-MM-DD"),
        dateAt,
        requiredPersonnelTotal, // Add total personnel count
        ...columnStyles, // Add style-related information
      });
    }

    return result;
  });

  const dateRange = Vue.computed(() => {
    return dateRangeComposable.dateRange.value;
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
    cachedData: Vue.readonly(cached),
    docs,
    schema: SiteOperationSchedule,
    instance,
    workers,

    // STATE
    dateRange: Vue.readonly(dateRange),
    columns,

    // Attributes for manager component.
    arrayManagerAttrs,
    itemManagerAttrs,

    // statistics
    statistics: workersComposable.statistics,

    // METHODS
    getWorkerName,
    setFrom: dateRangeComposable.setBaseDate,
    setDayCount: dateRangeComposable.setDayCount,
    toCreate: () => manager?.value?.toCreate?.(),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
