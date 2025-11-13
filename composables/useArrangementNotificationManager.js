import * as Vue from "vue";
import { ArrangementNotification } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";

export function useArrangementNotificationManager(doc = {}, options = {}) {
  const component = Vue.ref(null);
  const instance = Vue.reactive(new ArrangementNotification());

  /***************************************************************************
   * SETUP COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("ArrangementNotificationManager", useErrorsStore());

  Vue.watch(
    () => doc,
    (newDoc) => instance.initialize(newDoc),
    {
      immediate: true,
      deep: true,
    }
  );

  function set(notification) {
    if (!notification) {
      logger.error({ error: new Error("Invalid notification instance.") });
      return;
    }
    if (notification instanceof ArrangementNotification === false) {
      logger.error({
        error: new Error(
          "The notification is not an ArrangementNotification instance."
        ),
      });
      return;
    }
    if (!component.value) {
      logger.error({ error: new Error("Component is not mounted.") });
      return;
    }
    if (typeof component.value.toUpdate !== "function") {
      logger.error({
        error: new Error("Component does not have toUpdate method."),
      });
      return;
    }
    component.value.toUpdate(notification);
  }

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
  };
}
