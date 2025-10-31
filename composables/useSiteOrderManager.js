/**
 * @file composables/useSiteOrderManager.js
 * @description A Composable for management site-order.
 */
import * as Vue from "vue";
import { SiteOrder } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

export function useSiteOrderManager({
  dialogOptions = {
    maxWidth: "480",
    scrollable: true,
    persistent: true,
  },
  fetchSiteComposable,
} = {}) {
  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const internalSiteOrder = ref([]);
  const loading = ref(false);
  const isActive = ref(false); // For dialog active state

  /***************************************************************************
   * DEFINE COMPOSABLE
   ***************************************************************************/
  const { company } = useAuthStore();
  const logger = useLogger("useSiteOrderManager", useErrorsStore());
  const { fetchSite, cachedSites } = fetchSiteComposable || useFetchSite();

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  watch(
    () => company.siteOrder,
    (newValue) => {
      fetchSite(newValue);
      internalSiteOrder.value = [...newValue];
    },
    { immediate: true, deep: true }
  );

  /***************************************************************************
   * DEFINE METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Submit the changes to the company siteOrder.
   * @throws {Error} If the update fails.
   */
  async function _submit() {
    logger.clearError();
    loading.value = true;
    try {
      company.siteOrder = [...internalSiteOrder.value];
      await company.update();
      isActive.value = false;
    } catch (error) {
      logger.error({ message: error.message, error });
    } finally {
      loading.value = false;
    }
  }

  /**
   * Cancel the changes and revert to the original company siteOrder.
   */
  function _cancel() {
    internalSiteOrder.value = [...company.siteOrder];
    isActive.value = false;
  }

  /***************************************************************************
   * DEFINE METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Open the site order manager dialog.
   */
  function set() {
    isActive.value = true;
  }

  /**
   * Add new siteOrder.
   * @param {Object} params
   * @param {string} params.siteId - The ID of the site.
   * @param {string} params.shiftType - The shift type of the site.
   * @param {number} index - The index to add the site order at.
   */
  async function add({ siteId, shiftType }, index = -1) {
    logger.clearError();
    loading.value = true;
    try {
      company.siteOrder.add({ siteId, shiftType }, index);
      await company.update();
    } catch (error) {
      logger.error({ message: error.message, error });
    } finally {
      loading.value = false;
    }
  }

  /**
   * Change the siteOrder of a site.
   * @param {number} oldIndex - The old index of the site.
   * @param {number} newIndex - The new index of the site.
   */
  async function change(oldIndex, newIndex) {
    logger.clearError();
    loading.value = true;
    try {
      company.siteOrder.change(oldIndex, newIndex);
      await company.update();
    } catch (error) {
      logger.error({ message: error.message, error });
    } finally {
      loading.value = false;
    }
  }

  /**
   * Remove a site order.
   * @param {string} key - The ID of the site order to remove.
   */
  async function remove(key) {
    logger.clearError();
    loading.value = true;
    try {
      company.siteOrder.remove(key);
      await company.update();
    } catch (error) {
      logger.error({ message: error.message, error });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /**
   * Computed site order with site names included.
   */
  const computedSiteOrder = Vue.computed({
    get() {
      return internalSiteOrder.value.map((item) => {
        return {
          ...item.toObject(),
          siteName: cachedSites.value[item.siteId]?.name,
        };
      });
    },
    set(v) {
      internalSiteOrder.value = v.map((item) => new SiteOrder(item));
    },
  });

  /**
   * Attributes for the component
   */
  const attrs = computed(() => {
    return {
      modelValue: computedSiteOrder.value,
      loading: loading.value,
      "onUpdate:model-value": (value) => (computedSiteOrder.value = value),
      "onClick:submit": _submit,
      "onClick:cancel": _cancel,
    };
  });

  const dialogAttrs = computed(() => {
    return {
      ...dialogOptions,
      modelValue: isActive.value,
      "onUpdate:model-value": (value) => (isActive.value = value),
    };
  });

  return {
    siteOrder: computedSiteOrder,
    attrs,
    dialogAttrs,

    // methods
    set,
    add,
    change,
    remove,
  };
}
