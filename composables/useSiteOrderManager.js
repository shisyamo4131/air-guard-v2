/**
 * @file composables/useSiteOrderManager.js
 * @description A Composable for management site-order.
 */
import * as Vue from "vue";
import { SiteOrder } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";

export function useSiteOrderManager({ manager, fetchSiteComposable }) {
  /***************************************************************************
   * DEFINE COMPOSABLE
   ***************************************************************************/
  const { company } = useAuthStore();
  const logger = useLogger("useSiteOrderManager", useErrorsStore());
  const { fetchSite } = fetchSiteComposable || {};

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const siteOrder = Vue.ref([]);
  const editingSiteOrder = Vue.ref([]);
  const isOpen = Vue.ref(false); // Dialog visibility state
  const isLoading = Vue.ref(false); // Loading state for async operations

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  // Watch for changes in company.siteOrder and sync to local order.
  Vue.watchEffect(_initialize);

  // Watch for changes in `isOpen` state and call manager's open/close methods if available.
  Vue.watch(isOpen, (val) => {
    manager?.[val ? "open" : "close"]?.();
    if (!val) _initialize(); // Reinitialize when manager is closed
  });

  /***************************************************************************
   * METHODS FOR PRIVATE
   ***************************************************************************/
  function _initialize() {
    const newSiteOrder = company?.siteOrder || [];
    siteOrder.value = newSiteOrder.slice();
    editingSiteOrder.value = newSiteOrder.slice();
    if (newSiteOrder.length <= 0) return;
    if (fetchSite) fetchSite(newSiteOrder);
  }

  /***************************************************************************
   * METHODS FOR PROVIDE
   ***************************************************************************/
  /**
   * Add new siteOrder.
   * @param {Object} params
   * @param {string} params.siteId - The ID of the site.
   * @param {string} params.shiftType - The shift type of the site.
   * @param {number} index - The index to add the site order at.
   */
  async function add({ siteId, shiftType }, index = -1) {
    logger.clearError();
    try {
      company.siteOrder.add({ siteId, shiftType }, index);
      await company.update();
    } catch (error) {
      logger.error({ message: error.message, error });
    }
  }

  /**
   * Change the siteOrder of a site.
   * @param {number} oldIndex - The old index of the site.
   * @param {number} newIndex - The new index of the site.
   */
  async function change(oldIndex, newIndex) {
    logger.clearError();
    try {
      company.siteOrder.change(oldIndex, newIndex);
      await company.update();
    } catch (error) {
      logger.error({ message: error.message, error });
    }
  }

  /**
   * Remove a site order.
   * @param {string} key - The ID of the site order to remove.
   */
  async function remove(key) {
    logger.clearError();
    try {
      company.siteOrder.remove(key);
      await company.update();
    } catch (error) {
      logger.error({ message: error.message, error });
    }
  }

  /**
   * Update the site order.
   * - All elements are converted to SiteOrder instances.
   * - All elements must have `siteId` and `shiftType` property.
   */
  async function update() {
    isLoading.value = true;
    try {
      if (!editingSiteOrder.value || !Array.isArray(editingSiteOrder.value)) {
        throw new Error("Invalid site order");
      }
      // Convert all elements to `SiteOrder` instance.
      const updatedOrder = editingSiteOrder.value.map(
        (item) => new SiteOrder(item)
      );

      // Validate the new order and throw error if any element is invalid.
      const isValid = updatedOrder.every((item) => {
        const { siteId, shiftType } = item;
        return siteId && shiftType;
      });
      if (!isValid) throw new Error("Invalid site order");

      // Update the company site order.
      company.siteOrder = updatedOrder;
      await company.update();
      isOpen.value = false; // Close the dialog after update
    } catch (error) {
      logger.error({ message: error.message, error, data: { newOrder } });
    } finally {
      isLoading.value = false;
    }
  }

  const attrs = computed(() => {
    return {
      modelValue: isOpen.value,
      siteOrder: editingSiteOrder.value,
      loading: isLoading.value,
      "onUpdate:model-value": ($event) => (isOpen.value = $event),
      "onUpdate:site-order": ($event) => (editingSiteOrder.value = $event),
      "onClick:cancel": () => (isOpen.value = false),
      "onClick:submit": update,
    };
  });

  return {
    siteOrder,
    attrs,
    open: () => (isOpen.value = true),
    add,
    change,
    remove,
  };
}
