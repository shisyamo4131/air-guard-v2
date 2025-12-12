/*****************************************************************************
 * useOperationResultManager
 * @version 1.0.0
 * @description A composable to manage operation result information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";
import { useFetchSite } from "./fetch/useFetchSite";
import { useFetchEmployee } from "./fetch/useFetchEmployee";
import { useFetchOutsourcer } from "./fetch/useFetchOutsourcer";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive OperationResult instance to manage.
 * @param {string} options.redirectPath - Path to redirect after deletion
 * @param {Object} options.fetchSiteComposable - Optional fetchSite composable to use for site data
 * @param {Object} options.fetchEmployeeComposable - Optional fetchEmployee composable to use for employee data
 * @param {Object} options.fetchOutsourcerComposable - Optional fetchOutsourcer composable to use for outsourcer data
 * @returns {Object} - The operation result manager composable
 * @returns {Object} doc - Reactive OperationResult instance
 * @returns {Object} attrs - Computed attributes for the operation result component
 * @returns {Object} cachedSites - Readonly ref of cached sites from fetchSite composable
 * @returns {Object} cachedEmployees - Readonly ref of cached employees from fetchEmployee composable
 * @returns {Object} cachedOutsourcers - Readonly ref of cached outsourcers from fetchOutsourcer composable
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 * @returns {Function} addWorker - Method to add a worker to the operation result
 * @returns {Function} changeWorker - Method to change a worker in the operation result
 * @returns {Function} removeWorker - Method to remove a worker from the operation result
 */
export function useOperationResultManager({
  doc = Vue.reactive(new OperationResult()),
  redirectPath = "/operation-results",
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useOperationResultManager", {
    doc,
    redirectPath,
  });

  /** VALIDATION */
  if (
    docManager.isDev &&
    (!fetchSiteComposable ||
      !fetchEmployeeComposable ||
      !fetchOutsourcerComposable)
  ) {
    const missingComposables = [];
    if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
    if (!fetchEmployeeComposable)
      missingComposables.push("fetchEmployeeComposable");
    if (!fetchOutsourcerComposable)
      missingComposables.push("fetchOutsourcerComposable");
    docManager.logger.info({
      message: `Consider providing the following composables to improve performance by caching data across multiple usages: ${missingComposables.join(
        ", "
      )}`,
    });
  }

  /** SETUP FETCH COMPOSABLES */
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  const { fetchEmployee, cachedEmployees } =
    fetchEmployeeComposable || useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } =
    fetchOutsourcerComposable || useFetchOutsourcer();

  /** WATCHERS */
  Vue.watch(doc, (newDoc) => {
    fetchSite(newDoc.siteId);
    fetchEmployee(newDoc.employeeIds);
    fetchOutsourcer(newDoc.outsourcerIds);
  });

  /** METHODS (PUBLIC) */
  // Add a worker to the operation result
  async function addWorker(worker) {
    try {
      doc.addWorker(worker, -1);
      await doc.update();
    } catch (error) {
      docManager.logger.error({ error });
    }
  }

  // Change a worker in the operation result
  async function changeWorker(worker) {
    try {
      doc.changeWorker(worker);
      await doc.update();
    } catch (error) {
      docManager.logger.error({ error });
    }
  }

  // Remove a worker from the operation result
  async function removeWorker(worker) {
    try {
      doc.removeWorker(worker);
      await doc.update();
    } catch (error) {
      docManager.logger.error({ error });
    }
  }

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    ...docManager,

    cachedSites: Vue.readonly(cachedSites),
    cachedEmployees: Vue.readonly(cachedEmployees),
    cachedOutsourcers: Vue.readonly(cachedOutsourcers),

    addWorker,
    changeWorker,
    removeWorker,
  };
}
