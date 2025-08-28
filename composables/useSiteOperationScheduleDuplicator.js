import { isProxy, toRaw, ref, computed } from "vue";
import dayjs from "dayjs";
import { useLogger } from "@/composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";

export function useSiteOperationScheduleDuplicator({
  submitText = "複製",
} = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES / STORES
   ***************************************************************************/
  const logger = useLogger();
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const schedule = ref(null);
  const dates = ref([]);
  const isLoading = ref(false);

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  /**
   * Returns whether the duplicator is in a submittable state.
   * @returns {boolean} - Whether the duplicator is submittable.
   */
  const isSubmittable = computed(() => {
    if (!schedule.value) return false;
    if (dates.value.length === 0) return false;
    if (dates.value.length > 20) return false;
    if (isLoading.value) return false;
    return true;
  });

  /**
   * Returns the binding options for the duplicator component.
   * @returns {Object} - The binding options for the duplicator component.
   */
  const bindOptions = computed(() => {
    return {
      modelValue: !!schedule.value,
      allowedDates: isDateAllowed,
      disableCancel: isLoading.value,
      disableSubmit: !isSubmittable.value,
      loading: isLoading.value,
      selectedDates: dates.value,
      submitText,
      "onUpdate:model-value": _initialize,
      "onUpdate:selected-dates": (value) => (dates.value = value),
      "onClick:cancel": _initialize,
      // "onClick:cancel": () => {
      //   console.log("canceled");
      //   _initialize();
      // },
      "onClick:submit": duplicate,
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
    dates.value = [];
  }

  /**
   * Returns whether the given date is allowed for duplication.
   * @param {Date} date - The date to check.
   * @returns {boolean} - Whether the date is allowed for duplication.
   */
  const isDateAllowed = (date) => {
    if (!schedule.value) return true;
    return dayjs(date).format("YYYY-MM-DD") !== schedule.value.date;
  };

  const set = (obj) => {
    try {
      const instance = isProxy(obj) ? toRaw(obj) : obj;
      if (!(instance instanceof SiteOperationSchedule)) {
        throw new Error("Invalid schedule object");
      }
      schedule.value = obj;
    } catch (error) {
      logger.error({ error, data: obj });
    }
  };
  /**
   * Duplicates the current schedule.
   * - Throw error if no schedule is set.
   * @returns {Promise<void>}
   */
  const duplicate = async () => {
    logger.clearError();
    const loadingKey = loadingsStore.add({ text: "Duplicating schedule..." });
    isLoading.value = true;
    try {
      if (!schedule.value) throw new Error("No schedule to duplicate.");
      await schedule.value.duplicate(dates.value);
      _initialize();
    } catch (error) {
      logger.error({ error });
    } finally {
      isLoading.value = false;
      loadingsStore.remove(loadingKey);
    }
  };

  return {
    bindOptions,
    set,
  };
}
