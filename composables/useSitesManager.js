/*****************************************************************************
 * useSitesManager
 * @version 1.0.0
 * @description A composable to manage sites information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useRouter } from "vue-router";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "./useLogger";
import { Site } from "@/schemas";

// Constraints to fetch only active sites.
const statusOption = ["where", "status", "==", Site.STATUS_ACTIVE];

// Default sorting by customer code in descending order.
const sortBy = [{ key: "code", order: "desc" }];

/**
 * @returns {Object} - Sites manager attributes and information.
 * @returns {Object} attrs - The attributes for the sites manager.
 * @returns {Array} docs - The array of site documents.
 */
export function useSitesManager() {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("SitesManager", useErrorsStore());
  const router = useRouter();

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Site());
  const search = Vue.ref("");
  const loading = Vue.ref(false);
  const component = Vue.ref(null);

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  function _subscribe() {
    logger.clearError();
    try {
      loading.value = true;
      const constraints = search.value ? search.value : [statusOption];
      const options = search.value ? [statusOption] : [];
      instance.subscribeDocs({ constraints, options });
    } catch (error) {
      logger.error({ error });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: instance.docs,
      schema: Site,
      beforeEdit: (editMode, item) => {
        if (editMode === "CREATE") return true;
        router.push(`sites/${item.docId}`);
        return false;
      },
      handleCreate: (item) => item.create(),
      delay: 300,
      loading: loading.value,
      search: search.value,
      tableProps: { customFilter: () => true, sortBy },
      onCreate: ($event) => router.push(`sites/${$event.docId}`),
      "onUpdate:search": (val) => (search.value = val),
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    attrs,
    docs: Vue.readonly(instance.docs),
  };
}
