import { computed, ref } from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { SiteOperationSchedule, SiteOperationScheduleDetail } from "@/schemas";

export function useSiteOperationScheduleDetailEditor() {
  /***************************************************************************
   * DEFINE COMPOSABLES / STORES
   ***************************************************************************/
  const logger = useLogger(
    "useSiteOperationScheduleDetailEditor",
    useErrorsStore()
  );
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const schedule = ref(null);
  const worker = ref(new SiteOperationScheduleDetail());
  const isLoading = ref(false);

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  const isReady = computed(() => {
    return !!schedule.value;
  });

  /**
   * Returns the binding options for the duplicator component.
   * @returns {Object} - The binding options for the duplicator component.
   */
  const bindOptions = computed(() => {
    return {
      modelValue: isReady.value,
      disableCancel: isLoading.value,
      loading: isLoading.value,
      "onUpdate:model-value": _initialize,
      "onClick:cancel": _initialize,
      "onClick:submit": submit,
    };
  });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * Initializes the state.
   * @returns {void}
   */
  function _initialize() {
    schedule.value = null;
    worker.value = new SiteOperationScheduleDetail();
  }

  /**
   * Set the schedule and index.
   * @param {SiteOperationSchedule} obj
   * @param {number} newIndex
   * @returns {void}
   */
  const set = ({ schedule: obj, worker: target } = {}) => {
    try {
      const instance = isProxy(obj) ? toRaw(obj) : obj;
      if (!(instance instanceof SiteOperationSchedule)) {
        throw new Error("Invalid schedule object");
      }
      if (!obj.employees.find((emp) => emp === target)) {
        throw new Error("Invalid worker object");
      }
      schedule.value = obj;
      worker.value = new SiteOperationScheduleDetail(target);
    } catch (error) {
      logger.error({ error, data: obj });
    }
  };

  const submit = async () => {
    logger.clearError();
    const loadingKey = loadingsStore.add({ text: "Update schedule..." });
    isLoading.value = true;
    try {
      const index = schedule.value.employees.findIndex(
        (emp) => emp.workerId === worker.value.workerId
      );
      if (index < 0) {
        throw new Error("Worker not found in schedule");
      }
      schedule.value.employees.splice(index, 1, worker.value);
      await schedule.value.update();
      _initialize();
    } catch (error) {
      logger.error({
        error,
        data: {
          schedule: schedule.value,
          worker: worker.value,
        },
      });
    } finally {
      isLoading.value = false;
      loadingsStore.remove(loadingKey);
    }
  };

  return {
    bindOptions,
    worker,
    set,
  };
}
