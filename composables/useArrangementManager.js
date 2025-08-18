/**
 * @file useArrangementManager.js
 * @description Composable for managing site operation schedules.
 * This composable provides `subscribe` method for listening to `SiteOperationSchedule` documents.
 * - If the `fetchEmployee` composable is provided, it will automatically fetch employee data related to the retrieved `SiteOperationSchedule` documents.
 * - If the `fetchOutsourcer` composable is provided, it will automatically fetch outsourcer data related to the retrieved `SiteOperationSchedule` documents.
 * @param {Object} options - Configuration options.
 * @param {Object} [options.manager] - Manager instance for schedule operations.
 * @param {Object} [options.fetchEmployeeComposable] - Custom composable for fetching employees.
 * @param {Object} [options.fetchOutsourcerComposable] - Custom composable for fetching outsourcers.
 */
import * as Vue from "vue";
import { useNuxtApp } from "#app";
import { runTransaction } from "firebase/firestore";
import {
  SHIFT_TYPE_DAY,
  SHIFT_TYPE_NIGHT,
} from "air-guard-v2-schemas/constants";

/** Messages */
const MANAGER_NOT_PROVIDED_WARNING =
  "Manager should be provided to useArrangementManager.";

export function useArrangementManager({
  docs = [],
  manager,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  // Warn if manager is not provided
  if (!manager) console.warn(MANAGER_NOT_PROVIDED_WARNING);

  /** define instance & refs */
  const localDocs = Vue.ref([]); // Local documents for optimistic updates.

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  /**
   * Watches the `docs` array for changes and fetches related data.
   */
  Vue.watch(
    docs,
    (newDocs = []) => {
      _fetchRelatedData(Vue.toRaw(newDocs));
      localDocs.value = [...newDocs].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      );
    },
    { deep: true, immediate: true }
  );

  /***************************************************************************
   * PRIVATE METHODS
   ***************************************************************************/
  /**
   * Fetch related data from the provided documents.
   * - employees, outsourcers, and sites.
   * @param {Array} newDocs
   */
  function _fetchRelatedData(newDocs) {
    if (!Array.isArray(newDocs) || newDocs.length === 0) return;

    const allEmployees = newDocs.flatMap((schedule) => {
      const rawSchedule = Vue.toRaw(schedule);
      return Array.isArray(rawSchedule.employees) ? rawSchedule.employees : [];
    });
    if (allEmployees.length > 0 && fetchEmployeeComposable) {
      fetchEmployeeComposable.fetchEmployee(allEmployees);
    }

    const allOutsourcers = newDocs.flatMap((schedule) => {
      const rawSchedule = Vue.toRaw(schedule);
      return Array.isArray(rawSchedule.outsourcers)
        ? rawSchedule.outsourcers
        : [];
    });
    if (allOutsourcers.length > 0 && fetchOutsourcerComposable) {
      fetchOutsourcerComposable.fetchOutsourcer(allOutsourcers);
    }
  }

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
  const optimisticUpdates = async (newSchedules, siteId, shiftType, date) => {
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

  /***************************************************************************
   * COMPUTED PROPERTIES FOR PROVIDE
   ***************************************************************************/
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

  /**
   * A map of employees who are scheduled on each date.
   */
  const arrangedEmployeesMap = Vue.computed(() => {
    const result = localDocs.value.reduce((acc, schedule) => {
      if (!acc[schedule.date])
        acc[schedule.date] = { allDay: [], day: [], night: [] };
      acc[schedule.date].allDay.push(...(schedule.employeeIds || []));
      if (schedule.shiftType === SHIFT_TYPE_DAY) {
        acc[schedule.date].day.push(...(schedule.employeeIds || []));
      } else if (schedule.shiftType === SHIFT_TYPE_NIGHT) {
        acc[schedule.date].night.push(...(schedule.employeeIds || []));
      }
      return acc;
    }, {});

    // Remove duplicates for each array
    Object.values(result).forEach((entry) => {
      entry.allDay = Array.from(new Set(entry.allDay));
      entry.day = Array.from(new Set(entry.day));
      entry.night = Array.from(new Set(entry.night));
    });
    return result;
  });

  const statistics = Vue.computed(() => {
    const requiredPersonnel = localDocs.value.reduce((acc, schedule) => {
      if (!acc[schedule.date]) acc[schedule.date] = 0;
      acc[schedule.date] += schedule.requiredPersonnel || 0;
      return acc;
    }, {});

    return {
      arrangedEmployeesMap: arrangedEmployeesMap.value,
      requiredPersonnel,
    };
  });

  return {
    // data
    docs: keyMappedDocs, // Mapped schedules grouped by key (siteId-shiftType-date).
    statistics,

    // METHODS
    optimisticUpdates,

    // Methods for managing schedules provided by the manager.
    toCreate: (schedule) => manager?.value?.toCreate?.(schedule),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
