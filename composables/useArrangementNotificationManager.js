import * as Vue from "vue";
import { ArrangementNotification } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";

export function useArrangementNotificationManager() {
  const component = Vue.ref(null);
  const instance = Vue.reactive(new ArrangementNotification());

  /***************************************************************************
   * SETUP COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("ArrangementNotificationManager", useErrorsStore());

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  function set(param) {
    if (!param) {
      throw new Error("Invalid parameter provided to set method");
    }
    if (typeof param === "string") {
      instance.subscribe({ docId: param });
    }
    if (typeof param === "object" && param.docId) {
      instance.subscribe({ docId: param.docId });
    }
  }

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: instance,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      hideDeleteBtn: true,
      onError: (error) => logger.error({ error }),
      "onError:clear": () => logger.clearError(),
    };
  });

  return {
    attrs,
    set,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
