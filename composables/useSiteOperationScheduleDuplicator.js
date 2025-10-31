import { isProxy, toRaw, ref, computed } from "vue";
import dayjs from "dayjs";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";

/**
 * A Composable to manage duplicating `SiteOperationSchedule`.
 * @param {Object} param
 * @param {Object} param.dialog - The dialog options. Accept attributes to customize the dialog.
 *                                Set to `falsy` to disable dialog.
 * @param {string} param.submitText - The submit button text.
 * @returns {Object} - The duplicator composable.
 * @return {Object} attrs - The binding attributes for the duplicator component.
 * @return {Object} dialogAttrs - The binding attributes for the dialog component.
 * @return {Function} set - The method to set the schedule to duplicate.
 */
export function useSiteOperationScheduleDuplicator({
  dialog = {
    width: 376,
    persistent: true,
    scrollable: true,
  },
  submitText = "複製",
} = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES / STORES
   ***************************************************************************/
  const logger = useLogger(
    "useSiteOperationScheduleDuplicator",
    useErrorsStore()
  );
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const schedule = ref(null);
  const dates = ref([]);
  const isLoading = ref(false);
  const isActive = ref(false); // For dialog.

  /*****************************************************************************
   * METHODS (PRIVATE)
   *****************************************************************************/
  /**
   * Initializes the state.
   * @returns {void}
   */
  function _initialize() {
    schedule.value = null;
    dates.value = [];
    isActive.value = false;
  }

  /**
   * Duplicates the current schedule.
   * - Throw error if no schedule is set.
   * @returns {Promise<void>}
   */
  const _duplicate = async () => {
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

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * Returns whether the given date is allowed for duplication.
   * @param {Date} date - The date to check.
   * @returns {boolean} - Whether the date is allowed for duplication.
   */
  const isDateAllowed = (date) => {
    if (!schedule.value) return true;
    return dayjs(date).format("YYYY-MM-DD") !== schedule.value.date;
  };

  /**
   * Sets the schedule to duplicate.
   * @param {Object} obj - The schedule object to duplicate.
   * @returns {void}
   * @throws {Error} - If the provided object is not a valid SiteOperationSchedule.
   */
  const set = (obj) => {
    try {
      const instance = isProxy(obj) ? toRaw(obj) : obj;
      if (!(instance instanceof SiteOperationSchedule)) {
        throw new Error("Invalid schedule object");
      }
      schedule.value = obj;
      if (!!dialog) isActive.value = true;
    } catch (error) {
      logger.error({ error, data: obj });
    }
  };

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
  const attrs = computed(() => {
    return {
      allowedDates: isDateAllowed,
      disableCancel: isLoading.value,
      disableSubmit: !isSubmittable.value,
      loading: isLoading.value,
      selectedDates: dates.value,
      submitText,
      "onUpdate:selected-dates": (value) => (dates.value = value),
      "onClick:cancel": _initialize,
      "onClick:submit": _duplicate,
    };
  });

  const dialogAttrs = computed(() => {
    return {
      modelValue: isActive.value,
      "onUpdate:model-value": _initialize,
      ...dialog,
    };
  });

  return {
    attrs,
    dialogAttrs,
    set,
  };
}
