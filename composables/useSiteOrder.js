/**
 * @file composables/useSiteOrder.js
 * @description A Composable for management site-order.
 */
import * as Vue from "vue";
import { SiteOrder } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "@/composables/useLogger";

export function useSiteOrder({ manager, fetchSiteComposable }) {
  /***************************************************************************
   * DEFINE COMPOSABLE
   ***************************************************************************/
  const { company } = useAuthStore();
  const logger = useLogger("useSiteOrder");
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
   * @param {Object} param0
   * @param {string} param0.siteId - The ID of the site.
   * @param {string} param0.shiftType - The shift type of the site.
   * @param {number} index - The index to add the site order at.
   */
  function add({ siteId, shiftType }, index = -1) {
    logger.clearError();
    try {
      const newOrderInstance = new SiteOrder({ siteId, shiftType });
      company.addSiteOrder(newOrderInstance, index);
    } catch (error) {
      logger.error({ message: error.message, error });
    }
  }

  /**
   * Change the siteOrder of a site.
   * @param {number} oldIndex - The old index of the site.
   * @param {number} newIndex - The new index of the site.
   */
  function change(oldIndex, newIndex) {
    logger.clearError();
    try {
      company.changeSiteOrder(oldIndex, newIndex);
    } catch (error) {
      logger.error({ message: error.message, error });
    }
  }

  /**
   * Remove a site order.
   * @param {string} key - The ID of the site order to remove.
   */
  function remove(key) {
    logger.clearError();
    try {
      company.removeSiteOrder(key);
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
