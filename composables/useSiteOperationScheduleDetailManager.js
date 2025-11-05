/**
 * @file composables/useSiteOperationScheduleDetailManager.js
 * @description Composable for managing SiteOperationScheduleDetail editing.
 *
 * @returns {Object} attrs - Attributes for binding to the detail manager component.
 * @returns {Function} set - Function to set the schedule and worker detail for editing.
 */
import * as Vue from "vue";
import { SiteOperationSchedule, SiteOperationScheduleDetail } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSiteOperationScheduleDetailManager() {
  /***************************************************************************
   * DEFINE REACTIVE OBJECTS
   ***************************************************************************/
  const schedule = Vue.ref(null);
  const worker = Vue.ref(new SiteOperationScheduleDetail());
  const component = Vue.ref(null);
  const isLoading = Vue.ref(false);

  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const logger = useLogger(
    "SiteOperationScheduleDetailManager",
    useErrorsStore()
  );
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * DEFINE METHODS (PRIVATE)
   ***************************************************************************/
  async function _submit(val) {
    logger.clearError();
    const loadingKey = loadingsStore.add({ text: "Update schedule..." });
    isLoading.value = true;
    try {
      schedule.value.changeWorker(val);
      await schedule.value.update();
    } catch (error) {
      logger.error({ error });
    } finally {
      isLoading.value = false;
      loadingsStore.remove(loadingKey);
    }
  }

  function _handleCreate() {
    throw new Error("Not implemented: handleCreate");
  }

  async function _handleUpdate(val) {
    return await _submit(val);
  }

  function _handleDelete() {
    throw new Error("Not implemented: handleDelete");
  }

  /***************************************************************************
   * DEFINE METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Sets the schedule and worker detail for editing.
   * @param {Object} params - The parameters object.
   * @param {SiteOperationSchedule} params.schedule - The SiteOperationSchedule instance.
   * @param {SiteOperationScheduleDetail} params.worker - The worker detail to edit.
   */
  function set({ schedule: obj, worker: target } = {}) {
    try {
      const instance = isProxy(obj) ? toRaw(obj) : obj;
      if (!(instance instanceof SiteOperationSchedule)) {
        throw new Error(
          `Invalid schedule object. Expected SiteOperationSchedule.`
        );
      }
      const targetProp = target.isEmployee ? "employees" : "outsourcers";
      if (!obj[targetProp].find((w) => w === target)) {
        throw new Error(
          `Invalid worker object. Expected ${targetProp} to contain the worker.`
        );
      }
      schedule.value = obj;
      worker.value = new SiteOperationScheduleDetail(target);
      const fn = component?.value?.toUpdate;
      if (!fn) {
        throw new Error(`Component method toUpdate not found.`);
      }
      fn.call(component.value, worker.value);
    } catch (error) {
      logger.error({ error, data: obj });
    }
  }

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: Vue.readonly(worker.value),
      handleCreate: () => _handleCreate(),
      handleUpdate: (val) => _handleUpdate(val),
      handleDelete: () => _handleDelete(),
      onError: (e) => error({ error: e }),
      "onError:clear": clearError,
    };
  });

  return { attrs, set };
}
