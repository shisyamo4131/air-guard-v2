/*****************************************************************************
 * Site Manager Composable ver 1.0.0
 * @description A composable to manage Site instance.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/**
 * @returns {Object} - The site manager composable
 * @returns {Object} doc - Reactive Site instance
 * @returns {Object} attrs - Computed attributes for the site component
 * @returns {Function} set - Method to set docId to subscribe.
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useSiteManager() {
  /***************************************************************************
   * VALIDATION
   ***************************************************************************/

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const internalDocId = Vue.ref(null);
  const instance = Vue.reactive(new Site());
  const component = Vue.ref(null);

  /***************************************************************************
   * STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("SiteManager", useErrorsStore());

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/

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
    if (internalDocId.value) instance.subscribe({ docId: internalDocId.value });
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
      inputProps: {
        excludedKeys: ["agreements"],
      },
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
    };
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    doc: Vue.readonly(instance),
    attrs,

    set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
