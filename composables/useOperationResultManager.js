/*****************************************************************************
 * useOperationResultManager
 * @version 1.0.0
 * @description A composable to manage operation result information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";
import { useRouter } from "vue-router";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchSite } from "./fetch/useFetchSite";
import { useFetchEmployee } from "./fetch/useFetchEmployee";
import { useFetchOutsourcer } from "./fetch/useFetchOutsourcer";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive OperationResult instance to manage.
 * @param {Object} options.fetchSiteComposable - Optional fetchSite composable to use for site data
 * @param {Object} options.fetchEmployeeComposable - Optional fetchEmployee composable to use for employee data
 * @param {Object} options.fetchOutsourcerComposable - Optional fetchOutsourcer composable to use for outsourcer data
 * @param {boolean|string} options.immediate - If truthy, sets the docId immediately
 * @returns {Object} - The operation result manager composable
 * @returns {Object} doc - Reactive OperationResult instance
 * @returns {Object} attrs - Computed attributes for the operation result component
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {Object} includedKeys - Computed included keys for the manager component
 * @returns {Object} includedKeys.base - Base included keys for the operation result
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
  doc,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  deleteRedirectPath = "/operation-results",
} = {}) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger("OperationResultManager", useErrorsStore());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  if (
    isDev &&
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
    logger.info({
      message: `Consider providing the following composables to improve performance by caching data across multiple usages: ${missingComposables.join(
        ", "
      )}`,
    });
  }

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const router = useRouter();

  // Fetch composables
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  const { fetchEmployee, cachedEmployees } =
    fetchEmployeeComposable || useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } =
    fetchOutsourcerComposable || useFetchOutsourcer();

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const component = Vue.ref(null);

  /***************************************************************************
   * WATHERS
   ***************************************************************************/
  Vue.watch(doc, (newDoc) => {
    fetchSite(newDoc.siteId);
    fetchEmployee(newDoc.employeeIds);
    fetchOutsourcer(newDoc.outsourcerIds);
  });

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /** Add a worker to the operation result */
  async function addWorker(worker) {
    try {
      doc.addWorker(worker, -1);
      await doc.update();
    } catch (error) {
      logger.error({ error });
    }
  }

  /** Change a worker in the operation result */
  async function changeWorker(worker) {
    try {
      doc.changeWorker(worker);
      await doc.update();
    } catch (error) {
      logger.error({ error });
    }
  }

  /** Remove a worker from the operation result */
  async function removeWorker(worker) {
    try {
      doc.removeWorker(worker);
      await doc.update();
    } catch (error) {
      logger.error({ error });
    }
  }

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: doc,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      onDelete: () => router.replace(deleteRedirectPath),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
    };
  });

  /** Information for the `information-card` */
  const info = Vue.computed(() => {
    const base = [
      { title: "CODE", props: { subtitle: doc.code } },
      {
        title: "現場名",
        props: {
          subtitle: cachedSites.value?.[doc.siteId]?.name || "loading...",
        },
      },
      {
        title: "日付",
        props: {
          subtitle: dayjs(doc.dateAt).format("YYYY年M月D日（ddd）"),
        },
      },
      {
        title: "区分",
        props: {
          subtitle: `${OperationResult.DAY_TYPE[doc.dayType] || "loading..."} ${
            OperationResult.SHIFT_TYPE[doc.shiftType]?.title || "loading..."
          }`.trim(),
        },
      },
      {
        title: "時間",
        props: {
          subtitle: `${doc.startTime || "loading..."} - ${
            doc.endTime || "loading..."
          }`.trim(),
        },
      },
      {
        title: "作業内容",
        props: { subtitle: doc.workDescription },
      },
      { title: "備考", props: { subtitle: doc.remarks } },
    ];
    return { base };
  });

  /** Included keys for the manager component */
  const includedKeys = computed(() => {
    const base = [
      "code",
      "dateAt",
      "dayType",
      "shiftType",
      "startTime",
      "endTime",
      "breakMinutes",
      "workDescription",
      "remarks",
    ];
    return { base };
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    doc,
    attrs,
    info,
    includedKeys,

    cachedSites: Vue.readonly(cachedSites),
    cachedEmployees: Vue.readonly(cachedEmployees),
    cachedOutsourcers: Vue.readonly(cachedOutsourcers),

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),

    addWorker,
    changeWorker,
    removeWorker,
  };
}
