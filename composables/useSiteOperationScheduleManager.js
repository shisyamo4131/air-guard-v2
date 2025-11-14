/***************************************************************************
 * useSiteOperationScheduleManager
 * @version 1.0.0
 * @description A composable to manage site operation schedule.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSiteOperationScheduleManager() {
  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());
  const component = Vue.ref(null);

  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const { error, clearError } = useLogger(
    "SiteOperationScheduleManager",
    useErrorsStore()
  );

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
   * Subscribe to site operation schedule document.
   * - If a string is provided, it is treated as a document ID to subscribe to.
   * - If a SiteOperationSchedule instance is provided, it subscribes to its document ID.
   * @param {string|SiteOperationSchedule} param
   * @throws Will throw an error if the parameter is invalid.
   */
  function set(param) {
    if (!param) {
      throw new Error(`No parameter provided to set. ${JSON.stringify(param)}`);
    }
    if (typeof param === "string") {
      _subscribe(param);
    } else if (param instanceof SiteOperationSchedule) {
      _subscribe(param.docId);
    } else {
      throw new Error(
        `Invalid parameter provided to set. ${JSON.stringify(param)}`
      );
    }
  }

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
      onError: (e) => error({ error: e }),
      "onError:clear": clearError,
    };
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  return {
    attrs,

    set,
    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
