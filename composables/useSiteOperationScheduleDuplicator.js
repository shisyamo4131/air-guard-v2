import { ref, toRaw, isProxy, watch } from "vue";
import { useLogger } from "@/composables/useLogger";
import { useLoadingsStore } from "../stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";
import dayjs from "dayjs";

const sender = "useSiteOperationScheduleDuplicator";

/**
 * @file composables/useSiteOperationScheduleDuplicator.js
 * @description A composable for duplicating site operation schedules.
 * - Use this composable with the `SiteOperationScheduleDuplicator` component.
 * - The `SiteOperationScheduleDuplicator` will open when a schedule to be duplicated is set using the `set` method.
 */
export function useSiteOperationScheduleDuplicator() {
  /***************************************************************************
   * DEFINE COMPOSABLES / STORES
   ***************************************************************************/
  const logger = useLogger();
  const loadingStore = useLoadingsStore();

  /***************************************************************************
   * DEFINE REFS
   * NOTE: `manager` is not used.
   ***************************************************************************/
  const dates = ref([]); // The dates to duplicate the schedule to
  const isLoading = ref(false); // Indicates if the duplication is in progress
  const schedule = ref(null); // The schedule to be duplicated
  const manager = ref(null); // The `SiteOperationScheduleDuplicator` component instance

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  watch(schedule, (newVal) => {
    newVal || _initialize();
  });

  /***************************************************************************
   * PRIVATE METHODS
   ***************************************************************************/
  /** Initialize this composable */
  function _initialize() {
    schedule.value = null;
    dates.value = [];
  }

  /***************************************************************************
   * METHODS
   ***************************************************************************/

  /**
   * Set the schedule object which will be duplicated.
   * @param {SiteOperationSchedule} obj
   */
  const set = (obj) => {
    try {
      const instance = isProxy(obj) ? toRaw(obj) : obj;
      if (!(instance instanceof SiteOperationSchedule)) {
        throw new Error("Invalid schedule object");
      }
      schedule.value = obj;
    } catch (error) {
      logger.error({ sender, message: error.message, error });
    }
  };

  /**
   * Duplicate the given schedule for the specified dates.
   * @param {Object} schedule - The SiteOperationSchedule instance to duplicate.
   */
  const duplicate = async () => {
    logger.clearError();
    loadingStore.add({ key: "duplicate", text: "Duplicating schedule..." });
    isLoading.value = true;

    try {
      if (!schedule.value || typeof schedule.value !== "object") {
        throw new Error("Invalid schedule object");
      }

      if (!Array.isArray(dates.value) || dates.value.length === 0) {
        throw new Error("Invalid dates array");
      }

      if (dates.value.length > 20) {
        throw new Error(
          "Too many dates selected. Please select up to 20 dates."
        );
      }

      // Skip the original date when duplicating
      dates.value = dates.value.filter((date) => date !== schedule.value.date);

      await schedule.value.duplicate(dates.value);

      schedule.value = null;
    } catch (error) {
      logger.error({ sender, message: error.message, error });
    } finally {
      isLoading.value = false;
      loadingStore.remove("duplicate");
    }
  };

  const result = computed(() => {
    return {
      ref: (el) => (manager.value = el),
      dates: dates.value,
      modelValue: !!schedule.value,
      persistent: true,
      pickerProps: {
        allowedDates: (date) => {
          if (!schedule.value) return true;
          return dayjs(date).format("YYYY-MM-DD") !== schedule.value.date;
        },
      },
      loading: isLoading.value,
      "onClick:cancel": _initialize,
      "onClick:submit": duplicate,
      "onUpdate:model-value": _initialize,
      "onUpdate:dates": (v) => (dates.value = v),
      set,
    };
  });

  return result;
}
