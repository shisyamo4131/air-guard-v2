import * as Vue from "vue";
import { Site } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSiteManager({ docId: providedDocId } = {}) {
  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new Site());
  const component = Vue.ref(null);

  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("SiteManager", useErrorsStore());

  /***************************************************************************
   * DEFINE METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe(docId) {
    instance.subscribe({ docId });
  }

  /***************************************************************************
   * DEFINE METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Set the Site instance to manage.
   * - If a string is provided, it is treated as a document ID to subscribe to.
   * - If a Site instance is provided, it subscribes to its document ID.
   * @param {string|Site} param
   * @throws Will throw an error if the parameter is invalid.
   */
  function set(param) {
    if (!param) {
      throw new Error(`No parameter provided to set. ${JSON.stringify(param)}`);
    }
    if (typeof param === "string") {
      _subscribe(param);
    } else if (param instanceof Site) {
      _subscribe(param.docId);
    } else {
      throw new Error(
        `Invalid parameter provided to set. ${JSON.stringify(param)}`
      );
    }
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watch(
    () => providedDocId,
    (newDocId) => {
      if (newDocId) _subscribe(newDocId);
    },
    { immediate: true }
  );

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
    instance: Vue.readonly(instance),
    attrs,

    set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
