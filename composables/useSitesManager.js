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

/***************************************************************************
 * A composable to manage sites.
 *
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
  const { error, clearError } = useLogger("SitesManager", useErrorsStore());
  const router = useRouter();

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  function subscribe() {
    try {
      loading.value = true;
      const statusOption = ["where", "status", "==", Site.STATUS_ACTIVE];
      const constraints = search.value ? search.value : [statusOption];
      const options = search.value ? [statusOption] : [];
      instance.subscribeDocs({ constraints, options });
    } catch (error) {
      error({ error, message: "Failed to fetch sites." });
    } finally {
      loading.value = false;
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(subscribe);

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
      inputProps: {
        excludedKeys: ["agreements"],
      },
      schema: Site,
      search: search.value,
      tableProps: {
        customFilter: () => true,
        sortBy: [{ key: "code", order: "desc" }],
      },
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

  return {
    attrs,
    docs: computed(() => instance.docs),
  };
}
