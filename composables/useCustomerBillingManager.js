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
  fetchCustomerComposable,
  fetchSiteComposable,
  immediate = false,
  deleteRedirectPath = "/operation-results",
} = {}) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger("CustomerBillingManager", useErrorsStore());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const internalDocId = Vue.ref(null);
  const instance = Vue.reactive(new Billing());
  const component = Vue.ref(null);
  const isLoading = Vue.ref(false);
  const isReady = Vue.ref(false);

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const router = useRouter();

  // Fetch composables
  const { fetchCustomer, cachedCustomers } =
    fetchCustomerComposable || useFetchCustomer();
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();

  if (isDev && (!fetchCustomerComposable || !fetchSiteComposable)) {
    const missingComposables = [];
    if (!fetchCustomerComposable)
      missingComposables.push("fetchCustomerComposable");
    if (!fetchSiteComposable) missingComposables.push("fetchSiteComposable");
    if (missingComposables.length > 0) {
      logger.info({
        message: `The following composables were not provided. Internal composables will be used, but if caching across multiple components is needed, specifying them will improve performance: ${missingComposables.join(
          ", "
        )}`,
      });
    }
  }

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe() {
    instance.subscribe({ docId: internalDocId.value }, (item) => {
      fetchCustomer(item.customerId);
      fetchSite(item.siteId);
    });
  }

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Set docId to composable and subscribe to document.
   * @param {import("vue").Ref|string} docId
   * @returns {void}
   */
  function subscribe(docId) {
    if (!docId || typeof Vue.unref(docId) !== "string") {
      logger.error({
        error: new Error("Invalid docId provided to subscribe method"),
      });
      return;
    }
    internalDocId.value = Vue.unref(docId);
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(() => {
    if (internalDocId.value) _subscribe();
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: Vue.readonly(instance),
      handleCreate: (item) => {
        throw new Error("Creation of customer billings is not supported");
      },
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => {
        throw new Error("Deletion of customer billings is not supported");
      },
      hideDeleteBtn: true,
      // 閲覧中に削除された場合の対応
      onDelete: () => router.replace(deleteRedirectPath),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
    };
  });

  /** Information for the `information-card` */
  const info = Vue.computed(() => {
    const base = [
      { title: "CODE", props: { subtitle: instance.code } },
      {
        title: "現場名",
        props: {
          subtitle: cachedSites.value?.[instance.siteId]?.name || "loading...",
        },
      },
      {
        title: "日付",
        props: {
          subtitle: dayjs(instance.dateAt).format("YYYY年M月D日（ddd）"),
        },
      },
      {
        title: "区分",
        props: {
          subtitle: `${
            OperationBilling.DAY_TYPE[instance.dayType] || "loading..."
          } ${
            OperationBilling.SHIFT_TYPE[instance.shiftType]?.title ||
            "loading..."
          }`.trim(),
        },
      },
      {
        title: "時間",
        props: {
          subtitle: `${instance.startTime || "loading..."} - ${
            instance.endTime || "loading..."
          }`.trim(),
        },
      },
      {
        title: "作業内容",
        props: { subtitle: instance.workDescription },
      },
      { title: "備考", props: { subtitle: instance.remarks } },
    ];
    const unitPriceBase = instance.agreement?.unitPriceBase || 0;
    const overtimeUnitPriceBase =
      instance.agreement?.overtimeUnitPriceBase || 0;
    const unitPriceQualified = instance.agreement?.unitPriceQualified || 0;
    const overtimeUnitPriceQualified =
      instance.agreement?.overtimeUnitPriceQualified || 0;
    const billingDate = instance.billingDateAt
      ? dayjs(instance.billingDateAt).format("YYYY年M月D日")
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
          appendIcon: instance.billingDateAt
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

  if (immediate) subscribe(immediate);

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    doc: instance,
    attrs,
    info,
    includedKeys,
    isReady: Vue.readonly(isReady),
    isLoading: Vue.readonly(isLoading),

    cachedCustomers: Vue.readonly(cachedCustomers),
    cachedSites: Vue.readonly(cachedSites),

    subscribe,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
