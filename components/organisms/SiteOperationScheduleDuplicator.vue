<script setup>
/**
 * @file components/organisms/SiteOperationScheduleDuplicator.vue
 * @description A component for duplicating site operation schedules.
 * - Use `set` method with the schedule to duplicate.
 */
import dayjs from "dayjs";
import { useLogger } from "@/composables/useLogger";
import { useLoadingsStore } from "../stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";

/** define refs */
const schedule = ref(null);
const dates = ref([]);
const isLoading = ref(false);

/***************************************************************************
 * DEFINE COMPOSABLES / STORES
 ***************************************************************************/
const logger = useLogger("SiteOperationScheduleDuplicator");
const loadingsStore = useLoadingsStore();

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Returns whether the given date is allowed for duplication.
 * @param date
 */
function allowedDates(date) {
  if (!schedule.value) return true;
  return dayjs(date).format("YYYY-MM-DD") !== schedule.value.date;
}

/**
 * Duplicate the schedule for the selected dates.
 */
async function duplicate() {
  logger.clearError();
  const loadingKey = loadingsStore.add({ text: "Duplicating schedule..." });
  isLoading.value = true;

  try {
    await schedule.value.duplicate(dates.value);
    schedule.value = null;
  } catch (error) {
    logger.error({
      message: error.message,
      error,
      data: { schedule: schedule.value },
    });
  } finally {
    isLoading.value = false;
    loadingsStore.remove(loadingKey);
  }
}

/**
 * Initialize states of this component.
 */
function initialize() {
  schedule.value = null;
  dates.value = [];
}

/**
 * Set the schedule object which will be duplicated.
 * @param {SiteOperationSchedule} obj
 */
function set(obj) {
  try {
    const instance = isProxy(obj) ? toRaw(obj) : obj;
    if (!(instance instanceof SiteOperationSchedule)) {
      throw new Error("Invalid schedule object");
    }
    schedule.value = obj;
  } catch (error) {
    logger.error({ message: error.message, error, data: obj });
  }
}

defineExpose({ set });
</script>

<template>
  <v-dialog
    :model-value="!!schedule"
    width="auto"
    persistent
    @update:model-value="initialize"
  >
    <MoleculesCardsSubmitCancel
      :disableCancel="isLoading"
      :disableSubmit="dates.length === 0 || isLoading"
      :loading="isLoading"
      submit-text="複製"
      @click:cancel="initialize"
      @click:submit="duplicate"
    >
      <v-date-picker
        v-model="dates"
        :allowed-dates="allowedDates"
        hide-header
        multiple
      />
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
