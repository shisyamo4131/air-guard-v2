/*****************************************************************************
 * useCustomerBillingManager
 * @version 1.0.0
 * @description A composable to manage customer billing information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { Billing } from "@/schemas";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchCustomer } from "./fetch/useFetchCustomer";
import { useFetchSite } from "./fetch/useFetchSite";

/**
 * @param {Object} options - Options for the composable
 */
export function useCustomerBillingManager({
  doc = Vue.reactive(new Billing()),
  redirectPath = null,
  fetchCustomerComposable,
  fetchSiteComposable,
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useOperationBillingManager", {
    doc,
    redirectPath,
  });

  /** VALIDATION */
  if (docManager.isDev && (!fetchCustomerComposable || !fetchSiteComposable)) {
    const missingComposables = [];
    if (!fetchCustomerComposable)
      missingComposables.push("fetchCustomerComposable");
    if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
    docManager.logger.info({
      message: `Consider providing the following composables to improve performance by caching data across multiple usages: ${missingComposables.join(
        ", "
      )}`,
    });
  }

  /** SETUP FETCH COMPOSABLES */
  const { fetchCustomer, cachedCustomers } =
    fetchCustomerComposable || useFetchCustomer();
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();

  /** WATCHERS */
  Vue.watch(doc, (newDoc) => {
    fetchCustomer(newDoc.customerId);
    fetchSite(newDoc.siteId);
  });

  /** COMPUTED PROPERTIES */
  // Attributes for the component
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,
      handleCreate: () => {
        throw new Error("Creation of customer billings is not supported");
      },
      handleDelete: () => {
        throw new Error("Deletion of customer billings is not supported");
      },
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
            OperationBilling.DAY_TYPE[doc.dayType] || "loading..."
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

  /** Included keys for the manager component */
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

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    ...docManager,

    attrs,
    info,
    includedKeys,

    cachedCustomers: Vue.readonly(cachedCustomers),
    cachedSites: Vue.readonly(cachedSites),
  };
}
