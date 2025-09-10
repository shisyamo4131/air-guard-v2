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
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
import { runTransaction } from "firebase/firestore";
import { useNuxtApp } from "#app";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
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
  fetchSiteComposable,
} = {}) {
  // Warn if manager is not provided
  if (!manager) console.warn(MANAGER_NOT_PROVIDED_WARNING);

  /***************************************************************************
   * DEFINE STORES & COMPOSABLES
   ***************************************************************************/
  const { company } = useAuthStore(); // For using 'siteOrder' at getCommandText.
  const logger = useLogger("useArrangementManager", useErrorsStore());

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
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

    if (newDocs.length > 0 && fetchSiteComposable) {
      fetchSiteComposable.fetchSite(newDocs); // Fetch sites related to the schedules
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

  const addWorker = async ({ schedule, id, isEmployee, newIndex }) => {
    schedule.addWorker({ id, isEmployee, index: newIndex });
    await schedule.update();
  };

  const removeWorker = async ({ schedule, workerId, isEmployee }) => {
    try {
      schedule.removeWorker({ workerId, isEmployee });
      await schedule.update();
    } catch (error) {
      logger.error({
        error,
        data: { schedule, workerId, isEmployee },
      });
    }
  };

  const changeWorker = async ({ schedule, oldIndex, newIndex, isEmployee }) => {
    logger.clearError();
    try {
      if (isEmployee && newIndex > schedule.employees.length - 1) {
        throw new Error("従業員は外注先の前に配置する必要があります。");
      } else if (!isEmployee && newIndex <= schedule.employees.length - 1) {
        throw new Error("外注先は従業員の後ろに配置する必要があります。");
      }
      schedule.changeWorker({ oldIndex, newIndex, isEmployee });
      await schedule.update();
    } catch (error) {
      logger.error({
        error,
        data: { schedule, oldIndex, newIndex, isEmployee },
      });
    }
  };

  /**
   * Generates command text for a specific date.
   * @param {string} date - Date in 'YYYY-MM-DD' format
   * @returns {string} - Command text for the specified date
   */
  const getCommandText = (date) => {
    const formattedDate = dayjs(date).locale(ja).format("YYYY年MM月DD日(ddd)");

    // Get schedules for the specified date
    const schedules = localDocs.value.filter(
      (schedule) => schedule.date === date
    );
    if (schedules.length === 0) {
      return `${formattedDate} 配置\n\n配置はありません。`;
    }

    const siteOrder = company?.siteOrder || [];

    // siteOrder順に並べ替え
    if (siteOrder.length > 0) {
      schedules.sort((a, b) => {
        const aIdx = siteOrder.findIndex(
          (order) =>
            order.siteId === a.siteId && order.shiftType === a.shiftType
        );
        const bIdx = siteOrder.findIndex(
          (order) =>
            order.siteId === b.siteId && order.shiftType === b.shiftType
        );
        // siteOrderに含まれていない場合は後ろに
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }

    const { cachedSites } = fetchSiteComposable;
    const { cachedEmployees } = fetchEmployeeComposable;
    const { cachedOutsourcers } = fetchOutsourcerComposable;
    const lines = schedules.reduce((acc, schedule, index, arr) => {
      const site = cachedSites.value[schedule.siteId] || "N/A";
      const siteName = site ? site.name : "不明な現場";
      const siteAddress = site ? site.address : "";
      const shiftType = schedule.shiftType === SHIFT_TYPE_DAY ? "日勤" : "夜勤";
      const mark = schedule.shiftType === SHIFT_TYPE_DAY ? "○" : "●";
      const basicTimeRange = `${schedule.startTime}〜${schedule.endTime}`;
      const employees =
        schedule.employees
          .map((emp) => {
            const employee = cachedEmployees.value[emp.workerId];
            if (!employee) return `${mark}unknown`;
            return `${mark}${employee.displayName}${employee?.title || ""}`;
          })
          .join("\n") || "";
      const outsourcers =
        schedule.outsourcers
          .map((out) => {
            const outsourcer = cachedOutsourcers.value[out.workerId];
            if (!outsourcer) return `${mark}unknown(${out.amount}名)`;
            return `${mark}${outsourcer.displayName}(${out.amount}名)`;
          })
          .join("\n") || "";
      acc.push(`【${siteName} - ${shiftType}】`);
      acc.push(siteAddress);
      acc.push(basicTimeRange);
      if (employees) acc.push(employees);
      if (outsourcers) acc.push(outsourcers);
      if (index !== arr.length - 1) {
        acc.push("\n");
      }
      return acc;
    }, []);

    return `${formattedDate} 配置\n\n` + lines.join("\n");
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

  /**
   * Statistics
   */
  const statistics = Vue.computed(() => {
    // Unique siteId-shiftType combination map
    //  -> Used to determine the number of unique site-shift combinations.
    //  -> This is useful for determininig whether any combinations that should be displayed are missing.
    const requiredSiteOrders = localDocs.value.reduce((acc, schedule) => {
      const key = `${schedule.siteId}-${schedule.shiftType}`;
      if (!acc[key])
        acc[key] = { siteId: schedule.siteId, shiftType: schedule.shiftType };
      return acc;
    }, {});

    // Missing site-shiftType combinations in company.siteOrder
    //  -> This is useful for identifying site-shift combinations that are scheduled but not included in the company's site order.
    //  -> This can help ensure that all necessary site-shift combinations are accounted for in the company's configuration.
    const missingSiteOrders = Object.values(requiredSiteOrders).filter(
      (req) => {
        return !company.siteOrder.some(
          (co) => co.siteId === req.siteId && co.shiftType === req.shiftType
        );
      }
    );
    missingSiteOrders.forEach((order) => {
      order.name =
        fetchSiteComposable?.cachedSites?.value[order.siteId]?.name || "N/A";
    });

    // Total required personnel per date
    const requiredPersonnel = localDocs.value.reduce((acc, schedule) => {
      if (!acc[schedule.date]) acc[schedule.date] = 0;
      acc[schedule.date] += schedule.requiredPersonnel || 0;
      return acc;
    }, {});

    return {
      arrangedEmployeesMap: arrangedEmployeesMap.value,
      missingSiteOrders,
      requiredPersonnel,
      requiredSiteOrders,
    };
  });

  return {
    // data
    docs: keyMappedDocs, // Mapped schedules grouped by key (siteId-shiftType-date).
    statistics,

    // METHODS
    getCommandText,
    optimisticUpdates,

    // Methods for managing schedules provided by the manager.
    toCreate: (schedule) => manager?.value?.toCreate?.(schedule),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
    addWorker,
    removeWorker,
    changeWorker,
  };
}
