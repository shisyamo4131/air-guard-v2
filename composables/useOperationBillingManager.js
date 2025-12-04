/*****************************************************************************
 * useOperationBillingManager
 * @version 1.0.0
 * @description A composable to manage operation billing information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationBilling } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";
import { useFetchSite } from "./fetch/useFetchSite";
import { useFetchEmployee } from "./fetch/useFetchEmployee";
import { useFetchOutsourcer } from "./fetch/useFetchOutsourcer";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.fetchSiteComposable - Optional fetchSite composable to use for site data
 * @param {Object} options.fetchEmployeeComposable - Optional fetchEmployee composable to use for employee data
 * @param {Object} options.fetchOutsourcerComposable - Optional fetchOutsourcer composable to use for outsourcer data
 * @param {boolean|string} options.immediate - If truthy, sets the docId immediately
 * @returns {Object} - The operation billing manager composable
 * @returns {Object} doc - Reactive OperationBilling instance
 * @returns {Object} attrs - Computed attributes for the operation billing component
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {Object} info.prices - Pricing information about the operation billing.
 * @returns {Object} includedKeys - Computed included keys for the manager component
 * @returns {Object} includedKeys.prices - Included keys for the prices section
 * @returns {Object} includedKeys.adjusted - Included keys for the adjusted section
 * @returns {Object} cachedSites - Readonly ref of cached sites from fetchSite composable
 * @returns {Object} cachedEmployees - Readonly ref of cached employees from fetchEmployee composable
 * @returns {Object} cachedOutsourcers - Readonly ref of cached outsourcers from fetchOutsourcer composable
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useOperationBillingManager({
  doc = Vue.reactive(new OperationBilling()),
  deleteRedirectPath = null,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useOperationBillingManager", {
    doc,
    deleteRedirectPath,
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
  /**
   * Toggle the lock status of the operation billing document.
   * @param {string} docId - The document ID of the operation billing.
   * @param {boolean} value - The new lock status.
   */
  async function toggleLock(docId, value) {
    docManager.isLoading.value = true;
    try {
      await OperationBilling.toggleLock(docId, value);
    } catch (e) {
      docManager.logger.error({ error: e });
    } finally {
      docManager.isLoading.value = false;
    }
  }

  /** COMPUTED PROPERTIES */
  // Attributes for the component
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,
      hideDeleteBtn: true,
    };
  });

  // An array of information for the information-card component
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
          subtitle: `${
            OperationBilling.DAY_TYPE[doc.dayType]?.title || "loading..."
          } ${
            OperationBilling.SHIFT_TYPE[doc.shiftType]?.title || "loading..."
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
    const unitPriceBase = doc.agreement?.unitPriceBase || 0;
    const overtimeUnitPriceBase = doc.agreement?.overtimeUnitPriceBase || 0;
    const unitPriceQualified = doc.agreement?.unitPriceQualified || 0;
    const overtimeUnitPriceQualified =
      doc.agreement?.overtimeUnitPriceQualified || 0;
    const billingDate = doc.billingDateAt
      ? dayjs(doc.billingDateAt).format("YYYY年M月D日")
      : "未設定";
    const billings = [
      {
        title: "基本単価",
        props: {
          subtitle: `${unitPriceBase}円/${overtimeUnitPriceBase}円`,
        },
      },
      {
        title: "資格者単価",
        props: {
          subtitle: `${unitPriceQualified}円/${overtimeUnitPriceQualified}円`,
        },
      },
      {
        title: "請求締日",
        props: {
          subtitle: billingDate,
          appendIcon: doc.billingDateAt
            ? undefined
            : "mdi-alert-circle-outline",
        },
      },
    ];
    return { base, billings };
  });

  // Included keys for the manager component
  const includedKeys = Vue.computed(() => {
    const agreement = ["agreement"];
    const adjusted = [
      "adjustedQuantityBase",
      "adjustedOvertimeBase",
      "adjustedQuantityQualified",
      "adjustedOvertimeQualified",
      "useAdjustedQuantity",
    ];
    return { agreement, adjusted };
  });

  // Site instance
  const site = Vue.computed(() => {
    return cachedSites?.value?.[doc.siteId] || null;
  });

  return {
    ...docManager,

    attrs,
    info,
    includedKeys,

    site: Vue.readonly(site),

    cachedSites: Vue.readonly(cachedSites),
    cachedEmployees: Vue.readonly(cachedEmployees),
    cachedOutsourcers: Vue.readonly(cachedOutsourcers),

    toggleLock,
  };
}
