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
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite as internalUseFetchSite } from "@/composables/fetch/useFetchSite";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOrder } from "@/composables/useSiteOrder";
import { DAY_TYPE_HOLIDAY, getDayType } from "air-guard-v2-schemas/constants";

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

  /**
   * useSiteOrder
   */
  const siteOrderComposable = useSiteOrder();

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
        localDocs.value = [...newDocs];
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
   * Update schedules for a specific cell (site, shift type, date combination)
   * @param {Array} newSchedules - New schedules array for the cell
   * @param {string} siteId - Site ID
   * @param {string} shiftType - Shift type
   * @param {string} date - Date (YYYY-MM-DD format)
   */
  const updateLocalDocs = (newSchedules, siteId, shiftType, date) => {
    // 該当するセル以外のスケジュールを保持
    const filteredSchedules = localDocs.value.filter((schedule) => {
      return !(
        schedule.siteId === siteId &&
        schedule.shiftType === shiftType &&
        schedule.date === date
      );
    });

    // 新しいスケジュール配列で置き換え
    localDocs.value = [...filteredSchedules, ...newSchedules];
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

  const cellMatrix = Vue.computed(() => {
    if (!localDocs.value || !localDocs.value.length) return [];

    const matrix = [];
    const sites = siteOrderComposable.order.value || [];

    sites.forEach(({ siteId, shiftType }) => {
      const cells = columns.value.map((column) => {
        return {
          key: `${siteId}-${shiftType}-${column.date}`,
          siteId,
          shiftType,
          date: column.date,
          column,
        };
      });
      matrix.push({ siteId, shiftType, cells });
    });

    return matrix;
  });
  return {
    // DATA
    cachedData: Vue.readonly(cached),
    docs,
    localDocs: Vue.readonly(localDocs), // readonly documents for optimistic updates
    dayCount,
    dateRange,
    keyMappedDocs,
    cellMatrix,

    // STATE
    columns,

    // Attributes for manager component.
    arrayManagerAttrs,
    itemManagerAttrs,
    calendarAttrs,

    // METHODS
    getWorkerName,
    updateLocalDocs,
    setFrom: dateRangeComposable.setBaseDate,
    toCreate: () => manager?.value?.toCreate?.(),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
