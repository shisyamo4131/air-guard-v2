/***************************************************************************
 * useArrangementsManager
 * @version 1.0.0
 * @description A composable to manage Arrangements.
 * - Provides some methods for managing site operation schedule and its workers
 *   to optimistically update.
 * - Date range composable is required for providing date range to attributes.
 * - Requires fetchSite, fetchEmployee, fetchOutsourcer composables to output
 *   command text.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
import { runTransaction } from "firebase/firestore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "../composables/useLogger";

/**
 * @param {Object} param
 * @param {Array<SiteOperationSchedule>} param.schedules - Schedules array.
 * @param {Array} param.notifications - Notifications array.
 * @param {Object} param.dateRangeComposable - Date range composable.
 * @param {Object} param.fetchEmployeeComposable - Employee fetch composable.
 * @param {Object} param.fetchOutsourcerComposable - Outsourcer fetch composable.
 * @param {Object} param.fetchSiteComposable - Site fetch composable.
 * @returns {Object} - Arrangements manager composable.
 * @returns {Object} return.attrs - Attributes for ArrangementsManager component.
 * @returns {Object} return.keyMappedSchedules - Key-mapped schedules.
 * @returns {Object} return.keyMappedNotifications - Key-mapped notifications.
 * @returns {Object} return.selectedDate - Selected date ref.
 * @returns {Object} return.statistics - Statistics about arrangements.
 * @returns {Function} return.addWorker - Method to add a worker to a schedule.
 * @returns {Function} return.moveWorker - Method to move a worker within a schedule.
 * @returns {Function} return.removeWorker - Method to remove a worker from a schedule.
 * @returns {Function} return.handleDraggableWorkerChangeEvent - Method to handle draggable change event.
 * @returns {Function} return.optimisticUpdates - Method to perform optimistic updates on schedules.
 * @returns {Function} return.getCommandText - Method to generate command text for a specific date.
 * @returns {Function} return.notify - Method to create a new arrangement notification.
 */
export function useArrangementsManager({
  schedules = [],
  notifications = [],
  dateRangeComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
} = {}) {
  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  /** Documents array synchronized `instance.docs` for optimistic updates. */
  const internalSchedules = Vue.ref([]);
  const selectedDate = Vue.ref(null);

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  if (schedules && !Array.isArray(schedules)) {
    throw new Error(`'schedules' must be an array.`);
  }
  if (notifications && !Array.isArray(notifications)) {
    throw new Error(`'notifications' must be an array.`);
  }
  const missingComps = [];
  if (!dateRangeComposable) missingComps.push("dateRangeComposable");
  if (!fetchSiteComposable) missingComps.push("fetchSiteComposable");
  if (!fetchEmployeeComposable) missingComps.push("fetchEmployeeComposable");
  if (!fetchOutsourcerComposable)
    missingComps.push("fetchOutsourcerComposable");
  if (missingComps.length > 0) {
    throw new Error(
      `Required composables are missing: ${missingComps.join(", ")}`
    );
  }

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("ArrangementsManager", useErrorsStore());
  const loadingsStore = useLoadingsStore();
  const { company } = useAuthStore();

  const { cachedSites } = fetchSiteComposable;
  const { cachedEmployees } = fetchEmployeeComposable;
  const { cachedOutsourcers } = fetchOutsourcerComposable;

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Synchronize instance.docs to internalSchedules.
   * New documents are sorted by `displayOrder` property.
   * @param {Array} v
   */
  function _syncInternalSchedules(v) {
    internalSchedules.value = [...v].sort((a, b) => {
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
  }

  /**
   * Returns the internal schedule corresponding to the given schedule.
   * @param {*} schedule
   * @returns {SiteOperationSchedule|null}
   */
  function _getInternalSchedule(schedule) {
    return internalSchedules.value.find((doc) => doc.docId === schedule.docId);
  }

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Create a new arrangement notification.
   * @param {Object} schedule - The schedule object containing notification details.
   */
  async function notify(schedule) {
    const key = loadingsStore.add(`Creating notifications`);
    try {
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadingsStore.remove(key);
    }
  }

  /**
   * Add new worker to the specified schedule.
   * @param {Object} param
   * @param {SiteOperationSchedule} param.schedule - schedule instance.
   * @param {string} param.id - employee or outsourcer document id.
   * @param {boolean} param.isEmployee - Whether new worker is employee or not.
   * @param {number} newIndex - Additional position.
   * @returns {SiteOperationSchedule|null} - The updated internal schedule or null if not found.
   * @throws Will throw an error if the schedule is not found in internalSchedules.
   *
   * @update 2025-12-24 インスタンスの更新処理を行わず、呼び出し元でまとめて更新するように変更
   */
  async function addWorker({ schedule, id, isEmployee } = {}, newIndex = 0) {
    const internalSchedule = _getInternalSchedule(schedule);
    if (!internalSchedule) {
      logger.error({
        message: `Schedule not found in internalSchedules: ${schedule.docId}`,
      });
      return;
    }
    internalSchedule.addWorker({ id, isEmployee }, newIndex);

    // 2025-12-24 コメントアウト
    // await internalSchedule.update();
    return internalSchedule;
  }

  /**
   * Move worker within the specified schedule.
   * @param {Object} param
   * @param {SiteOperationSchedule} param.schedule - schedule instance.
   * @param {number} param.oldIndex - Current position.
   * @param {number} param.newIndex - New position.
   * @param {boolean} param.isEmployee - Whether worker is employee or not.
   * @throws Will throw an error if trying to move employees after outsourcers
   *         or outsourcers before employees.
   *
   * @update 2025-12-24 インスタンスの更新処理を行わず、呼び出し元でまとめて更新するように変更
   */
  async function moveWorker({ schedule, oldIndex, newIndex, isEmployee }) {
    const internalSchedule = _getInternalSchedule(schedule);
    if (!internalSchedule) {
      logger.error({
        message: `Schedule not found in internalSchedules: ${schedule.docId}`,
      });
      return;
    }

    if (isEmployee && newIndex > internalSchedule.employees.length - 1) {
      logger.error({ message: "従業員は外注先の前に配置する必要があります。" });
      return;
    } else if (
      !isEmployee &&
      newIndex <= internalSchedule.employees.length - 1
    ) {
      logger.error({
        message: "外注先は従業員の後ろに配置する必要があります。",
      });
      return;
    }
    internalSchedule.moveWorker({ oldIndex, newIndex, isEmployee });

    // 2025-12-24 コメントアウト
    // await internalSchedule.update();
    return internalSchedule;
  }

  /**
   * Removes a worker from the specified schedule.
   * @param {Object} param
   * @param {SiteOperationSchedule} param.schedule - schedule instance.
   * @param {string} param.workerId - worker id.
   * @param {boolean} param.isEmployee - Whether worker is employee or not.
   * @returns {SiteOperationSchedule|null} - The updated internal schedule or null if not found.
   * @throws Will throw an error if the schedule is not found in internalSchedules.
   *
   * @update 2025-12-24 インスタンスの更新処理を行わず、呼び出し元でまとめて更新するように変更
   */
  async function removeWorker({ schedule, workerId, isEmployee }) {
    const internalSchedule = _getInternalSchedule(schedule);
    if (!internalSchedule) {
      logger.error({
        message: `Schedule not found in internalSchedules: ${schedule.docId}`,
      });
      return;
    }
    internalSchedule.removeWorker({ workerId, isEmployee });

    // 2025-12-24 コメントアウト
    // await internalSchedule.update();
    return internalSchedule;
  }

  /**
   * Handles the draggable change event for workers in a schedule.
   * @param {Object} param
   * @param {Object} param.event - The change event from vuedraggable.
   * @param {SiteOperationSchedule} param.schedule
   * @returns {Promise<void>}
   * @throws Will throw an error if the event structure is invalid or unknown.
   *
   * @update 2025-12-24 インスタンスの更新処理をここで行うように変更。
   */
  async function handleDraggableWorkerChangeEvent({ event, schedule }) {
    try {
      let internalSchedule = null;

      if (event.added) {
        const { element, newIndex } = event.added;
        if (!element || typeof element !== "object") {
          logger.error({
            message: `Invalid argument in added event: ${JSON.stringify(
              event
            )}`,
          });
          return;
        }
        const { id, isEmployee } = element;
        if (!id || typeof isEmployee !== "boolean") {
          logger.error({
            message: `Invalid argument in added event: ${JSON.stringify(
              event
            )}`,
          });
          return;
        }

        // 2025-12-24 コメントアウト
        // await addWorker({ schedule, id, isEmployee }, newIndex);
        internalSchedule = await addWorker(
          { schedule, id, isEmployee },
          newIndex
        );
      } else if (event.moved) {
        const { element, oldIndex, newIndex } = event.moved ?? {};
        if (!element || typeof element !== "object") {
          logger.error({
            message: `Invalid argument in moved event: ${JSON.stringify(
              event
            )}`,
          });
          return;
        }
        const { isEmployee } = element;
        if (typeof isEmployee !== "boolean") {
          logger.error({
            message: `Invalid argument in moved event: ${JSON.stringify(
              event
            )}`,
          });
          return;
        }

        // 2025-12-24 コメントアウト
        // await moveWorker({ schedule, oldIndex, newIndex, isEmployee });
        internalSchedule = await moveWorker({
          schedule,
          oldIndex,
          newIndex,
          isEmployee,
        });
      } else if (event.removed) {
        const { workerId, isEmployee } = event.removed?.element ?? {};
        if (!workerId || typeof isEmployee !== "boolean") {
          logger.error({
            message: `Invalid argument in removed event: ${JSON.stringify(
              event
            )}`,
          });
          return;
        }

        // 2025-12-24 コメントアウト
        // await removeWorker({ schedule, workerId, isEmployee });
        internalSchedule = await removeWorker({
          schedule,
          workerId,
          isEmployee,
        });
      } else {
        logger.error({
          message: `Unknown draggable event: ${JSON.stringify(event)}`,
        });
        return;
      }

      // 2025-12-24 added
      // まとめて更新
      if (internalSchedule) await internalSchedule.update();
    } catch (error) {
      logger.error({ error });
    }
  }

  /**
   * Replaces the schedules specified by groupKey to the new schedules.
   * The siteId, shiftType, and date of the new schedule are updated to
   * the values specified in groupKey.
   * For optimistic update, `internalSchedules` is updated immediately before
   * transaction updates.
   * @param {Object} param
   * @param {Array<Object>} param.newSchedules
   * @param {string} param.groupKey
   * @returns {Promise<void>}
   * @throws Will throw an error if 'newSchedules' is not an array
   *         or 'groupKey' is not provided.
   */
  async function optimisticUpdates({ newSchedules = [], groupKey } = {}) {
    try {
      if (!Array.isArray(newSchedules)) {
        logger.error({ message: `'newSchedules' must be an array.` });
        return;
      }

      if (!groupKey || typeof groupKey !== "string") {
        logger.error({
          message: `'groupKey' is required and must be a string.`,
        });
        return;
      }

      // Evacuate unapplicable documents.
      const unapplicableDocs = internalSchedules.value.filter(
        (doc) => !(doc.groupKey === groupKey)
      );

      const [siteId, shiftType, date] =
        SiteOperationSchedule.groupKeyDivider(groupKey);

      // Update siteId, shiftType and dateAt based on groupKey.
      // NOTE: Do not create new SiteOperationSchedule instance.
      // Arrangement notifications should be deleted automatically by
      // SiteOperaitonSchedule instance.
      newSchedules.forEach((schedule, index) => {
        schedule.siteId = siteId;
        schedule.shiftType = shiftType;
        schedule.dateAt = new Date(date);
        schedule.displayOrder = index;
      });

      // Replace internalSchedules with the new schedules
      internalSchedules.value = [...unapplicableDocs, ...newSchedules];

      // Update Firestore documents.
      const { $firestore } = useNuxtApp();
      await runTransaction($firestore, async (transaction) => {
        await Promise.all(
          newSchedules.map((schedule) => schedule.update({ transaction }))
        );
      });
    } catch (error) {
      logger.error({ error });
    }
  }

  /**
   * Generates command text for a specific date.
   * @param {string} date - Date in 'YYYY-MM-DD' format
   * @returns {string} - Command text for the specified date
   */
  function getCommandText(date) {
    const formattedDate = dayjs(date).locale(ja).format("YYYY年MM月DD日(ddd)");

    // Get schedules for the specified date
    const schedules = internalSchedules.value.filter(
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

    const lines = schedules.reduce((acc, schedule, index, arr) => {
      const site = cachedSites.value[schedule.siteId] || "N/A";
      const siteName = site ? site.name : "不明な現場";
      const siteAddress = site ? site.address : "";
      const shiftType =
        schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE_DAY
          ? "日勤"
          : "夜勤";
      const mark =
        schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE_DAY ? "○" : "●";
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
  }

  /**
   * Returns whether the employee is arranged on the selected date.
   * @param {string} id - Employee document ID.
   * @returns {boolean} - True if the employee is arranged on the selected date, false otherwise.
   */
  function isEmployeeArranged(id) {
    if (!selectedDate.value) return false;
    const arrangedEmployeeIds =
      arrangedEmployeesMap.value[selectedDate.value]?.allDay || [];
    return arrangedEmployeeIds.includes(id);
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watch(schedules, _syncInternalSchedules, {
    immediate: true,
    deep: true,
  });

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Key-mapped documents.
   * @returns {Object} - Key-mapped documents.
   */
  const keyMappedSchedules = Vue.computed(() => {
    const result = internalSchedules.value.reduce((acc, schedule) => {
      (acc[schedule.groupKey] ??= []).push(schedule);
      return acc;
    }, {});
    return result;
  });

  /**
   * A map of employees who are scheduled on each date.
   * @returns {Object} - Map of arranged employees by date.
   */
  const arrangedEmployeesMap = Vue.computed(() => {
    const result = internalSchedules.value.reduce((acc, schedule) => {
      if (!acc[schedule.date])
        acc[schedule.date] = { allDay: [], day: [], night: [] };
      acc[schedule.date].allDay.push(...(schedule.employeeIds || []));
      if (schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE_DAY) {
        acc[schedule.date].day.push(...(schedule.employeeIds || []));
      } else if (
        schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE_NIGHT
      ) {
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
   * Statistics about arrangements.
   * @returns {Object} - Statistics object.
   */
  const statistics = Vue.computed(() => {
    // Unique siteId-shiftType combination map
    //  -> Used to determine the number of unique site-shift combinations.
    //  -> This is useful for determininig whether any combinations that should be displayed are missing.
    const requiredSiteOrders = internalSchedules.value.reduce(
      (acc, schedule) => {
        const key = `${schedule.siteId}-${schedule.shiftType}`;
        acc[key] ??= { siteId: schedule.siteId, shiftType: schedule.shiftType };
        return acc;
      },
      {}
    );

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
      order.name = cachedSites?.value[order.siteId]?.name || "N/A";
    });

    // Total required personnel per date
    const requiredPersonnel = internalSchedules.value.reduce(
      (acc, schedule) => {
        if (!acc[schedule.date]) acc[schedule.date] = 0;
        acc[schedule.date] += schedule.requiredPersonnel || 0;
        return acc;
      },
      {}
    );

    return {
      arrangedEmployeesMap: arrangedEmployeesMap.value,
      missingSiteOrders,
      requiredPersonnel,
      requiredSiteOrders,
    };
  });

  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    const table = {
      modelValue: keyMappedSchedules.value,
      from: dateRangeComposable.dateRange.value.from,
      dayCount: dateRangeComposable.currentDayCount.value,
      statistics: statistics.value,
      "onUpdate:model-value": (event) => optimisticUpdates(event),
      "onChange:workers": (event) => handleDraggableWorkerChangeEvent(event),
      // "onClick:remove-worker": (event) => removeWorker(event),  // Deprecated 2025-12-24
    };
    return { table };
  });

  return {
    attrs,

    keyMappedSchedules,
    keyMappedNotifications: Vue.computed(() => {
      return notifications.reduce((acc, doc) => {
        acc[doc.docId] = doc;
        return acc;
      }, {});
    }),

    isEmployeeArranged,
    selectedDate,

    statistics,

    // methods
    addWorker,
    moveWorker,
    removeWorker,
    handleDraggableWorkerChangeEvent,
    optimisticUpdates,
    getCommandText,
    notify,
  };
}
