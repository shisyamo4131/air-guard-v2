import * as Vue from "vue";
import { SiteOrder } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "@/composables/useLogger";

export function useSiteOrder() {
  /** define composable */
  const { company } = useAuthStore();
  const logger = useLogger();
  const sender = "useSiteOrder";

  /** define refs */
  const order = Vue.ref([]);

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  // Watch for changes in company.siteOrder and sync to local order
  Vue.watch(
    () => company?.siteOrder,
    (newSiteOrder) => {
      order.value = newSiteOrder || [];
    },
    { immediate: true }
  );

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  function add({ siteId, shiftType }, index = -1) {
    logger.clearError();
    try {
      const newOrderInstance = new SiteOrder({ siteId, shiftType });
      company.addSiteOrder(newOrderInstance, index);
    } catch (error) {
      logger.error({ sender, message: error.message, error });
    }
  }

  function change(oldIndex, newIndex) {
    logger.clearError();
    try {
      company.changeSiteOrder(oldIndex, newIndex);
    } catch (error) {
      logger.error({ sender, message: error.message, error });
    }
  }

  function remove(key) {
    logger.clearError();
    try {
      company.removeSiteOrder(key);
    } catch (error) {
      logger.error({ sender, message: error.message, error });
    }
  }

  return {
    order,
    add,
    change,
    remove,
  };
}
