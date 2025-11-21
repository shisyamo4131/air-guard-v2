/***************************************************************************
 * useCustomerBillingsManager
 * @version 1.0.0
 * @description A composable to manage customer's billing records.
 *              Requires a dateRange composable to function.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { Billing, Customer, Site } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useLogger } from "../composables/useLogger";
import { useRouter } from "vue-router";
import dayjs from "dayjs";

/**
 * @param {*} options
 * @param {Object} options.dateRangeComposable - Composable that provides date range reactive object.
 * @param {boolean} [options.useDebounced=false] - Whether to use debounced date range from the composable.
 * @param {Object} [options.fetchCustomerComposable] - Optional fetchCustomer composable for caching.
 * @param {Object} [options.fetchSiteComposable] - Optional fetchSite composable for caching.
 * @param {boolean} [options.immediate=false] - Whether to subscribe immediately upon creation.
 * @return {Object} - Reactive objects and methods for managing customer billings.
 * @return {Array} return.docs - Array of Billing documents.
 * @return {Object} return.keyMappedDocs - Object mapping docId to Billing documents.
 * @return {Object} return.cachedCustomers - Cached customer data.
 * @return {Object} return.cachedSites - Cached site data.
 * @return {Object} return.attrs - Attributes for data table component.
 * @return {Function} return.subscribe - Method to subscribe to billing documents.
 * @return {Function} return.toCreate - Method to navigate to create billing page.
 * @return {Function} return.toUpdate - Method to navigate to update billing page.
 * @return {Function} return.toDelete - Method to navigate to delete billing page.
 */
export function useCustomerBillingsManager({
  dateRangeComposable,
  useDebounced = false,
  fetchCustomerComposable,
  fetchSiteComposable,
  immediate = false,
} = {}) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger("CustomerBillingsManager", useErrorsStore());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  if (!dateRangeComposable) {
    throw new Error("dateRangeComposable is required");
  }

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
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Billing());
  const component = Vue.ref(null);

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const router = useRouter();

  // If fetchCustomerComposable is not provided, use internal useFetchCustomer
  const { fetchCustomer, cachedCustomers } =
    fetchCustomerComposable || useFetchCustomer();

  // If fetchSiteComposable is not provided, use internal useFetchSite
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Subscribe to OperationBilling documents based on date range and siteId.
   * - siteId is optional; if not provided, all sites are considered.
   * @returns {void}
   */
  function _subscribe() {
    const dateRange = useDebounced
      ? dateRangeComposable.debouncedDateRange.value
      : dateRangeComposable.dateRange.value;
    const { from, to } = dateRange;
    if (!from || !to) return;
    const constraints = [
      ["where", "billingDateAt", ">=", from],
      ["where", "billingDateAt", "<=", to],
    ];
    instance.subscribeDocs({ constraints }, (doc) => {
      fetchCustomer(doc.customerId);
      fetchSite(doc.siteId);
    });
  }

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  function subscribe() {
    _subscribe();
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  const targetDateRange = useDebounced
    ? dateRangeComposable.debouncedDateRange
    : dateRangeComposable.dateRange;
  Vue.watch(targetDateRange, _subscribe);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Enriched documents with customer and site data for data table.
   */
  const enrichedDocs = Vue.computed(() => {
    return instance.docs.map((doc) => {
      const customer = cachedCustomers.value[doc.customerId] || new Customer();
      const site = cachedSites.value[doc.siteId] || new Site();
      const groupKey = `${customer.code}: ${customer.name}`;
      return {
        ...doc,
        customer,
        site,
        groupKey,
      };
    });
  });

  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: instance.docs,
      schema: Billing,
      beforeEdit: (editMode, item) => {
        router.push(`/billings/customers/${item.docId}`);
        return false;
      },
      hideCreateBtn: true,
      tableProps: {
        groupBy: [{ key: "groupKey" }],
        headers: [
          {
            title: "請求日",
            key: "billingDateAt",
            value: (item) => dayjs(item.billingDateAt).format("MM月DD日(ddd)"),
          },
          { title: "現場", key: "site.name" },
          {
            title: "実績数",
            key: "operationCount",
            value: (item) => item.operationResults.length.toLocaleString(),
          },
          {
            title: "売上額",
            key: "subtotal",
            value: (item) => item.subtotal.toLocaleString(),
          },
          {
            title: "消費税額",
            key: "taxAmount",
            value: (item) => item.taxAmount.toLocaleString(),
          },
          {
            title: "請求額",
            key: "totalAmount",
            value: (item) => item.totalAmount.toLocaleString(),
          },
          {
            title: "入金予定日",
            key: "paymentDueDate",
            value: (item) => dayjs(item.paymentDueDate).format("MM月DD日(ddd)"),
          },
        ],
        items: enrichedDocs.value,
        sortBy: [{ key: "billingDateAt", order: "desc" }],
      },
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /**
   * Mapped documents by their docId
   */
  const keyMappedDocs = Vue.computed(() => {
    return instance.docs.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  if (immediate) subscribe();

  /***************************************************************************
   * RETURN OBJECT
   ***************************************************************************/
  return {
    docs: Vue.readonly(instance.docs),
    keyMappedDocs: Vue.readonly(keyMappedDocs),
    cachedCustomers: Vue.readonly(cachedCustomers),
    cachedSites: Vue.readonly(cachedSites),
    attrs: Vue.readonly(attrs),

    subscribe,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
