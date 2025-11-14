/***************************************************************************
 * useSiteOperationScheduleDuplicator
 * @version 1.0.0
 * @description A composable to duplicate site operation schedules.
 * @author shisyamo4131
 ***************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";

/**
 * @returns {Object} - The site operation schedule duplicator composable.
 * @returns {Object} attrs - The binding attributes for the duplicator component.
 * @returns {Function} set - Function to set the schedule instance to duplicate.
 */
export function useSiteOperationScheduleDuplicator() {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger(
    "useSiteOperationScheduleDuplicator",
    useErrorsStore()
  );
  const loadingsStore = useLoadingsStore();

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());
  const component = Vue.ref(null);
  const isLoading = Vue.ref(false);
  const selectedDates = Vue.ref([]);

  /*****************************************************************************
   * METHODS (PRIVATE)
   *****************************************************************************/
  /**
   * Initializes the state.
   * @returns {void}
   */
  function _initialize() {
    instance.initialize();
    selectedDates.value = [];
  }

  async function _duplicate() {
    logger.clearError();
    const loadingKey = loadingsStore.add({ text: "Duplicating schedule..." });
    isLoading.value = true;
    try {
      await instance.duplicate(selectedDates.value);
      _initialize();
    } catch (error) {
      logger.error({ error });
    } finally {
      isLoading.value = false;
      loadingsStore.remove(loadingKey);
    }
  }

  /**
   * Returns whether the given date is allowed for duplication.
   * @param {Date} date - The date to check.
   * @returns {boolean} - Whether the date is allowed for duplication.
   */
  function _isDateAllowed(date) {
    return dayjs(date).format("YYYY-MM-DD") !== instance.date;
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/

  /*****************************************************************************
   * METHODS (PUBLIC)
   *****************************************************************************/
  /**
   * Set the schedule instance to duplicate.
   * @param {SiteOperationSchedule} schedule
   */
  function set(schedule) {
    if (!schedule || !(schedule instanceof SiteOperationSchedule)) {
      throw new Error("Invalid schedule instance");
    }
    instance.initialize(schedule.toObject());
    component.value.toUpdate();
  }

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  /**
   * Returns whether the duplicator is in a submittable state.
   * @returns {boolean} - Whether the duplicator is submittable.
   */
  const isSubmittable = Vue.computed(() => {
    if (selectedDates.value.length === 0) return false;
    if (selectedDates.value.length > 20) return false;
    if (isLoading.value) return false;
    return true;
  });

  /**
   * Returns the binding options for the duplicator component.
   * @returns {Object} - The binding options for the duplicator component.
   */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: instance,
      handleCreate: () => {
        logger.error({ message: "作成処理はできません。" });
      },
      handleUpdate: () => _duplicate(),
      handleDelete: () => {
        logger.error({ message: "削除処理はできません。" });
      },
      dialogProps: { width: 376 },
      editorProps: {
        disableCancel: isLoading.value,
        disableSubmit: !isSubmittable.value,
      },
      isLoading: isLoading.value,
      hideDeleteBtn: true,
      label: "予定複製",
      selectedDates: selectedDates.value,
      "onUpdate:selected-dates": (value) => (selectedDates.value = value),
      onInitialized: _initialize,
      allowedDates: _isDateAllowed,
    };
  });

  return { attrs, set };
}
