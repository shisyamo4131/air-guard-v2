import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSiteOperationScheduleManager(component = null) {
  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());

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
    instance.subscribeToDoc({ docId });
  }

  /***************************************************************************
   * DEFINE METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Set the SiteOperationSchedule instance to manage.
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
      modelValue: Vue.readonly(instance),
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      inputProps: {
        excludedKeys: [
          "siteId",
          "dayType",
          "shiftType",
          "employees",
          "outsourcers",
        ],
      },
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
