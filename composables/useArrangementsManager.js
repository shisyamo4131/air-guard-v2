import * as Vue from "vue";
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
import { runTransaction } from "firebase/firestore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDateRange } from "@/composables/useDateRange";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";
import { useWorkersList } from "@/composables/useWorkersList";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useSiteOrderManager } from "@/composables/useSiteOrderManager";

export function useArrangementsManager({
  dateRangeOption = {},
  useDebounce = false,
  duplicatorOptions = undefined,
} = {}) {
  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());

  /** Documents array synchronized `instance.docs` for optimistic updates. */
  const internalDocs = ref([]);

  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const { company } = useAuthStore();
  const {
    currentDayCount: dayCount,
    dateRange,
    debouncedDateRange,
  } = useDateRange(dateRangeOption);
  const fetchSiteComposable = useFetchSite();
  const { fetchSite, cachedSites } = fetchSiteComposable;
  const fetchEmployeeComposable = useFetchEmployee();
  const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;
  const fetchOutsourcerComposable = useFetchOutsourcer();
  const { fetchOutsourcer, cachedOutsourcers } = fetchOutsourcerComposable;
  const { open } = useArrangementSheetPdf({
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
    fetchSiteComposable,
  });
  const {
    initialize: initializeWorkersList,
    getWorker,
    availableEmployees,
    availableOutsourcers,
  } = useWorkersList({
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  });
  const {
    create: createNotification,
    get: getNotification,
    set: setNotification,
    attrs: notificationAttrs,
  } = useArrangementNotificationManager({ dateRange });

  const duplicator = useSiteOperationScheduleDuplicator(duplicatorOptions);
  const siteOrderManager = useSiteOrderManager({ fetchSiteComposable });

  /***************************************************************************
   * DEFINE METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Synchronize instance.docs to internalDocs.
   * New documents are sorted by `displayOrder` property.
   * @param {Array} v
   */
  function _syncLocalDocs(v) {
    internalDocs.value = [...v].sort((a, b) => {
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
  }

  /**
   * Subscribe `SiteOperationSchedule` documents.
   */
  function _subscribe() {
    const range = useDebounce ? dateRange.value : debouncedDateRange.value;
    const { from, to } = range;
    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];

    instance.subscribeDocs({ constraints }, (doc) => {
      fetchSite(doc);
      fetchEmployee(doc.employeeIds);
      fetchOutsourcer(doc.outsourcerIds);
    });
  }

  /***************************************************************************
   * DEFINE METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Add new worker to the specified schedule.
   * @param {Object} param
   * @param {SiteOperationSchedule} param.schedule - schedule instance.
   * @param {string} param.id - employee or outsourcer document id.
   * @param {boolean} param.isEmployee - Whether new worker is employee or not.
   * @param {number} newIndex - Additional position.
   */
  async function addWorker({ schedule, id, isEmployee } = {}, newIndex = 0) {
    schedule.addWorker({ id, isEmployee }, newIndex);
    await schedule.update();
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
   */
  async function moveWorker({ schedule, oldIndex, newIndex, isEmployee }) {
    if (isEmployee && newIndex > schedule.employees.length - 1) {
      throw new Error("従業員は外注先の前に配置する必要があります。");
    } else if (!isEmployee && newIndex <= schedule.employees.length - 1) {
      throw new Error("外注先は従業員の後ろに配置する必要があります。");
    }
    schedule.moveWorker({ oldIndex, newIndex, isEmployee });
    await schedule.update();
  }

  /**
   * Removes a worker from the specified schedule.
   * @param {Object} param
   * @param {SiteOperationSchedule} param.schedule - schedule instance.
   * @param {string} param.workerId - worker id.
   * @param {boolean} param.isEmployee - Whether worker is employee or not.
   */
  async function removeWorker({ schedule, workerId, isEmployee }) {
    schedule.removeWorker({ workerId, isEmployee });
    await schedule.update();
  }

  /**
   * Handles the draggable change event for workers in a schedule.
   * @param {Object} param
   * @param {Object} param.event - The change event from vuedraggable.
   * @param {SiteOperationSchedule} param.schedule
   * @returns {Promise<void>}
   * @throws Will throw an error if the event structure is invalid or unknown.
   */
  async function handleDraggableWorkerChangeEvent({ event, schedule }) {
    if (event.added) {
      const { element, newIndex } = event.added;
      if (!element || typeof element !== "object") {
        throw new Error(
          `Invalid argument in added event: ${JSON.stringify(event)}`
        );
      }
      const { id, isEmployee } = element;
      if (!id || typeof isEmployee !== "boolean") {
        throw new Error(
          `Invalid argument in added event: ${JSON.stringify(event)}`
        );
      }
      await addWorker({ schedule, id, isEmployee }, newIndex);
    } else if (event.moved) {
      const { element, oldIndex, newIndex } = event.moved ?? {};
      if (!element || typeof element !== "object") {
        throw new Error(
          `Invalid argument in moved event: ${JSON.stringify(event)}`
        );
      }
      const { isEmployee } = element;
      if (typeof isEmployee !== "boolean") {
        throw new Error(
          `Invalid argument in moved event: ${JSON.stringify(event)}`
        );
      }
      await moveWorker({ schedule, oldIndex, newIndex, isEmployee });
    } else if (event.removed) {
      const { workerId, isEmployee } = event.removed?.element ?? {};
      if (!workerId || typeof isEmployee !== "boolean") {
        throw new Error(
          `Invalid argument in removed event: ${JSON.stringify(event)}`
        );
      }
      await removeWorker({ schedule, workerId, isEmployee });
    } else {
      throw new Error(`Unknown draggable event: ${JSON.stringify(event)}`);
    }
  }

  /**
   * Replaces the schedules specified by groupKey to the new schedules.
   * The siteId, shiftType, and date of the new schedule are updated to
   * the values specified in groupKey.
   * For optimistic update, `internalDocs` is updated immediately before
   * transaction updates.
   * @param {Object} param
   * @param {Array<Object>} param.newSchedules
   * @param {string} param.groupKey
   * @returns {Promise<void>}
   * @throws Will throw an error if 'newSchedules' is not an array
   *         or 'groupKey' is not provided.
   */
  async function optimisticUpdates({ newSchedules = [], groupKey } = {}) {
    if (!Array.isArray(newSchedules)) {
      throw new Error(`'newSchedules' must be an array. ${newSchedules}`);
    }

    if (!groupKey || typeof groupKey !== "string") {
      throw new Error(`'groupKey' is required and must be a string.`);
    }

    // Evacuate unapplicable documents.
    const unapplicableDocs = internalDocs.value.filter(
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

    // Replace internalDocs with the new schedules
    internalDocs.value = [...unapplicableDocs, ...newSchedules];

    // Update Firestore documents.
    const { $firestore } = useNuxtApp();
    await runTransaction($firestore, async (transaction) => {
      await Promise.all(
        newSchedules.map((schedule) => schedule.update({ transaction }))
      );
    });
  }

  /**
   * Generates command text for a specific date.
   * @param {string} date - Date in 'YYYY-MM-DD' format
   * @returns {string} - Command text for the specified date
   */
  function getCommandText(date) {
    const formattedDate = dayjs(date).locale(ja).format("YYYY年MM月DD日(ddd)");

    // Get schedules for the specified date
    const schedules = internalDocs.value.filter(
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

  /***************************************************************************
   * DEFINE WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /** Watcher for synchronize instance.docs to localDocs. */
  Vue.watch(() => instance.docs, _syncLocalDocs, {
    immediate: true,
    deep: true,
  });

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Key-mapped documents.
   */
  const keyMappedDocs = Vue.computed(() => {
    const result = internalDocs.value.reduce((acc, schedule) => {
      (acc[schedule.groupKey] ??= []).push(schedule);
      return acc;
    }, {});
    return result;
  });

  /**
   * A map of employees who are scheduled on each date.
   */
  const arrangedEmployeesMap = Vue.computed(() => {
    const result = internalDocs.value.reduce((acc, schedule) => {
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

  const statistics = Vue.computed(() => {
    // Unique siteId-shiftType combination map
    //  -> Used to determine the number of unique site-shift combinations.
    //  -> This is useful for determininig whether any combinations that should be displayed are missing.
    const requiredSiteOrders = internalDocs.value.reduce((acc, schedule) => {
      const key = `${schedule.siteId}-${schedule.shiftType}`;
      acc[key] ??= { siteId: schedule.siteId, shiftType: schedule.shiftType };
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
      order.name = cachedSites?.value[order.siteId]?.name || "N/A";
    });

    // Total required personnel per date
    const requiredPersonnel = internalDocs.value.reduce((acc, schedule) => {
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

  const attrs = Vue.computed(() => {
    const table = {
      modelValue: keyMappedDocs.value,
      from: dateRange.value.from,
      dayCount: dayCount.value,
      siteOrder: siteOrderManager.siteOrder.value,
      statistics: statistics.value,
      "onClick:output-sheet": open,
      "onUpdate:model-value": (event) => optimisticUpdates(event),
      "onChange:workers": (event) => handleDraggableWorkerChangeEvent(event),
      "onClick:notify": (event) => createNotification(event),
      "onClick:notification": (event) => setNotification(event),
      "onClick:remove-worker": (event) => removeWorker(event),
      "onClick:hide": (event) => siteOrderManager.remove(event),
      "onClick:duplicate": (event) => duplicator.set(event),
    };
    return {
      table,
    };
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(() => {
    initializeWorkersList();
  });

  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  return {
    docs: Vue.readonly(internalDocs.value),
    dateRange,
    dayCount,
    keyMappedDocs,
    statistics,
    availableEmployees: Vue.readonly(availableEmployees),
    availableOutsourcers: Vue.readonly(availableOutsourcers),
    notificationAttrs: Vue.readonly(notificationAttrs),

    attrs,

    // methods
    addWorker,
    moveWorker,
    removeWorker,
    getWorker,
    handleDraggableWorkerChangeEvent,
    optimisticUpdates,
    getCommandText,
    generatePdf: open,
    createNotification,
    getNotification,
    setNotification,

    // composables
    duplicator,
    siteOrderManager,
  };
}
