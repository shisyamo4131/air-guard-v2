/**
 * @file composables/useOutsourcersManager.js
 * @description A composable to manage outsourcers.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { Outsourcer } from "@/schemas";

/***************************************************************************
 * A composable to manage outsourcers.
 *
 * @function useOutsourcersManager
 * @version 1.0.0
 * @returns {Object} attrs - The attributes for the outsourcers manager.
 * @returns {Array} docs - The array of outsourcer documents.
 ***************************************************************************/
export function useOutsourcersManager() {
  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Outsourcer());
  const search = Vue.ref("");
  const loading = Vue.ref(false);

  /***************************************************************************
   * COMPOSABLES
   ***************************************************************************/
  const { error, clearError } = useLogger(
    "OutsourcersManager",
    useErrorsStore()
  );

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  function subscribe() {
    try {
      loading.value = true;
      const statusOption = [
        "where",
        "contractStatus",
        "==",
        Outsourcer.STATUS_ACTIVE,
      ];
      const constraints = search.value ? search.value : [statusOption];
      const options = search.value ? [statusOption] : [];
      instance.subscribeDocs({ constraints, options });
    } catch (error) {
      error({ error, message: "Failed to fetch outsourcers." });
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
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: 300,
      schema: Outsourcer,
      search: search.value,
      tableProps: {
        customFilter: () => true,
        sortBy: [{ key: "code", order: "desc" }],
      },
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
