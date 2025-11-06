/**
 * @file composables/useSitesManager.js
 * @description A composable to manage sites.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useRouter } from "vue-router";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "./useLogger";
import { Site } from "@/schemas";

// Constraints to fetch only active sites.
const statusOption = ["where", "status", "==", Site.STATUS_ACTIVE];

// Default sorting by customer code in descending order.
const sortBy = [{ key: "code", order: "desc" }];

/***************************************************************************
 * @function useSitesManager
 * @version 1.0.0
 * @returns {Object} attrs - The attributes for the sites manager.
 * @returns {Array} docs - The array of site documents.
 ***************************************************************************/
export function useSitesManager() {
  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Site());
  const search = Vue.ref("");
  const loading = Vue.ref(false);

  /***************************************************************************
   * COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("SitesManager", useErrorsStore());
  const router = useRouter();

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
      logger.error({ error, message: "Failed to fetch sites." });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.docs,
      handleCreate: (item) => item.create(),
      beforeEdit: (editMode, item) => {
        if (editMode === "CREATE") return true;
        router.push(`sites/${item.docId}`);
        return false;
      },
      delay: 300,
      inputProps: { excludedKeys: ["agreements"] },
      schema: Site,
      search: search.value,
      tableProps: { customFilter: () => true, sortBy },
      onCreate: ($event) => router.push(`sites/${$event.docId}`),
      "onUpdate:search": (val) => (search.value = val),
      onError: (e) => error({ error: e }),
      "onError:clear": clearError,
    };
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => instance.unsubscribe());

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    attrs,
    docs: Vue.readonly(instance.docs),
  };
}
