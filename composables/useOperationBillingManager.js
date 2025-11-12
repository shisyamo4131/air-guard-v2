/*****************************************************************************
 * useOperationBillingManager
 * @version 1.0.0
 * @description A composable to manage operation billing information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { OperationBilling } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
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
 * @returns {Object} isReady - Readonly ref indicating if the document is ready
 * @returns {Object} cachedSites - Readonly ref of cached sites from fetchSite composable
 * @returns {Object} cachedEmployees - Readonly ref of cached employees from fetchEmployee composable
 * @returns {Object} cachedOutsourcers - Readonly ref of cached outsourcers from fetchOutsourcer composable
 * @returns {Function} set - Method to set docId to subscribe.
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useOperationBillingManager({
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  immediate = false,
} = {}) {
  /***************************************************************************
   * VALIDATION
   ***************************************************************************/

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const internalDocId = Vue.ref(null);
  const instance = Vue.reactive(new OperationBilling());
  const component = Vue.ref(null);

  const isReady = Vue.ref(false);

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("OperationBillingManager", useErrorsStore());

  // Fetch composables
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();
  const { fetchEmployee, cachedEmployees } =
    fetchEmployeeComposable || useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } =
    fetchOutsourcerComposable || useFetchOutsourcer();

  if (
    !fetchSiteComposable ||
    !fetchEmployeeComposable ||
    !fetchOutsourcerComposable
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
   * METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe() {
    isReady.value = false;
    instance.subscribe({ docId: internalDocId.value }, (item) => {
      fetchSite(item.siteId);
      fetchEmployee(item.employeeIds);
      fetchOutsourcer(item.outsourcerIds);
      isReady.value = true;
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
  function set(docId) {
    if (!docId || typeof Vue.unref(docId) !== "string") {
      logger.error({
        error: new Error("Invalid docId provided to set method"),
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
    isReady.value = false;
  });

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: Vue.readonly(instance),
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      hideDeleteBtn: true,
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
    const prices = [
      {
        title: "基本単価",
        props: {
          subtitle: `${instance.unitPriceBase}円/${instance.overtimeUnitPriceBase}円`,
        },
      },
      {
        title: "資格者単価",
        props: {
          subtitle: `${instance.unitPriceQualified}円/${instance.overtimeUnitPriceQualified}円`,
        },
      },
    ];
    return { base, prices };
  });

  /** Included keys for the manager component */
  const includedKeys = Vue.computed(() => {
    const prices = [
      "unitPriceBase",
      "overtimeUnitPriceBase",
      "unitPriceQualified",
      "overtimeUnitPriceQualified",
      "billingUnitType",
    ];
    const adjusted = [
      "adjustedQuantityBase",
      "adjustedOvertimeBase",
      "adjustedQuantityQualified",
      "adjustedOvertimeQualified",
      "useAdjustedQuantity",
    ];
    return { prices, adjusted };
  });

  if (immediate) set(immediate);

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    doc: instance,
    attrs,
    info,
    includedKeys,
    isReady: Vue.readonly(isReady),

    cachedSites: Vue.readonly(cachedSites),
    cachedEmployees: Vue.readonly(cachedEmployees),
    cachedOutsourcers: Vue.readonly(cachedOutsourcers),

    set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
