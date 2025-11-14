/*****************************************************************************
 * useArrangements
 * @version 1.0.0
 * @description A data layer composable for arrangements.
 * - Subscribes to `Employee` and `Outsourcer` documents filtered by active status
 *   immediately.
 * - Subscribes to date ranged `SiteOperationSchedule` and `ArrangementNotification'
 *   documents immediately.
 * - Requires dateRange, fetchSite, fetchEmployee, fetchOutsourcer composable.
 * @author shisyamo4131
 * @create 2025-11-14
 *
 * Note: DateRange を利用して在職中の従業員に絞り込む必要が将来出てくるはず。
 *****************************************************************************/
import * as Vue from "vue";
import {
  ArrangementNotification,
  SiteOperationSchedule,
  Employee,
  Outsourcer,
} from "@/schemas";

const isDebug = false;

/**
 * @param {*} options
 * @param {*} options.dateRangeComposable
 * @param {*} options.fetchSiteComposable
 * @param {*} options.fetchEmployeeComposable
 * @param {*} options.fetchOutsourcerComposable
 * @param {boolean} options.useDebounced - Whether to use debounced date range from dateRangeComposable
 * @returns {Object} - The arrangements data layer composable
 * @returns {Array} schedules - Array of SiteOperationSchedule documents
 * @returns {Array} notifications - Array of ArrangementNotification documents
 * @returns {Array} employees - Array of Employee documents
 * @returns {Array} outsourcers - Array of Outsourcer documents
 */
export function useArrangements({
  dateRangeComposable,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  useDebounced = false,
} = {}) {
  const siteOperationSchedule = Vue.reactive(new SiteOperationSchedule());
  const arrangementNotification = Vue.reactive(new ArrangementNotification());
  const employee = Vue.reactive(new Employee());
  const outsourcer = Vue.reactive(new Outsourcer());

  const sendDebugLog = (message) => {
    if (isDebug) console.info(`[useArrangements.js] ${message}`);
  };

  sendDebugLog("Initializing useArrangements composable...");

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
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
   * SETUP COMPOSABLES
   ***************************************************************************/
  const { fetchSite } = fetchSiteComposable;
  const { fetchEmployee } = fetchEmployeeComposable;
  const { fetchOutsourcer } = fetchOutsourcerComposable;

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Computed dateRange based on whether debounced is used.
   * - If useDebounced is true, uses debouncedDateRange from dateRangeComposable.
   * - Otherwise, uses dateRange from dateRangeComposable.
   * @returns {Object} dateRange with from and to properties.
   */
  const _dateRange = Vue.computed(() => {
    return useDebounced
      ? dateRangeComposable.debouncedDateRange.value
      : dateRangeComposable.dateRange.value;
  });

  /**
   * Subscribe to Employee documents.
   * @returns {void}
   */
  function _subscribeEmployees() {
    sendDebugLog("Subscribing to Employee documents...");

    // NOTE: DateRange を利用して期間中在職中の従業員に絞り込むことになると思う。
    const constraints = [
      ["where", "employmentStatus", "==", Employee.STATUS_ACTIVE],
    ];
    employee.subscribeDocs({ constraints }, (doc) => {
      fetchEmployee(doc.docId);
    });
  }

  /**
   * Subscribe to Outsourcer documents.
   * @returns {void}
   */
  function _subscribeOutsourcers() {
    sendDebugLog("Subscribing to Outsourcer documents...");

    const constraints = [
      ["where", "contractStatus", "==", Outsourcer.STATUS_ACTIVE],
    ];
    outsourcer.subscribeDocs({ constraints }, (doc) => {
      fetchOutsourcer(doc.docId);
    });
  }

  /**
   * Subscribe to SiteOperationSchedule documents based on date range.
   * @returns {void}
   */
  function _subscribeSchedules() {
    sendDebugLog("Subscribing to SiteOperationSchedule documents...");
    // generate constraints
    const { from, to } = _dateRange.value;
    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];

    // subscribe with fetch related data
    siteOperationSchedule.subscribeDocs({ constraints }, (doc) => {
      sendDebugLog(
        `Fetched SiteOperationSchedule document with ID: ${doc.docId}`
      );
      fetchSite(doc.siteId);
      fetchEmployee(doc.employeeIds);
      fetchOutsourcer(doc.outsourcerIds);
    });
  }

  /**
   * Subscribe to ArrangementNotification documents based on date range.
   * @returns {void}
   */
  function _subscribeNotifications() {
    sendDebugLog("Subscribing to ArrangementNotification documents...");
    // generate constraints
    const { from, to } = _dateRange.value;
    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];

    // subscribe with fetch related data
    arrangementNotification.subscribeDocs({ constraints }, (doc) => {
      sendDebugLog(
        `Fetched ArrangementNotification document with ID: ${doc.docId}`
      );
      fetchSite(doc.siteId);
      fetchEmployee(doc.employeeIds);
      fetchOutsourcer(doc.outsourcerIds);
    });
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watch(
    _dateRange,
    () => {
      sendDebugLog("Date range changed, resubscribing...");
      _subscribeEmployees();
      _subscribeOutsourcers();
      _subscribeSchedules();
      _subscribeNotifications();
    },
    { immediate: true }
  );

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(() => {
    sendDebugLog("Mounted");
  });

  Vue.onUnmounted(() => {
    sendDebugLog("Unmounted");
    employee.unsubscribe();
    outsourcer.unsubscribe();
    siteOperationSchedule.unsubscribe();
    arrangementNotification.unsubscribe();
  });

  /***************************************************************************
   * RETURNED OBJECTS
   ***************************************************************************/
  return {
    schedules: siteOperationSchedule.docs,
    notifications: arrangementNotification.docs,
    employees: employee.docs,
    outsourcers: outsourcer.docs,
  };
}
