<script setup>
/**
 * @file components/arrangements/WorkerTag.vue
 * @description A component for displaying a arrangemented worker tag.
 *
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Object} schedule - The schedule object associated with the worker.
 * @props {Object} worker - The worker object containing relevant information.
 * @props {String} variant - The visual variant of the tag.
 *
 * @emit {Event} click:remove - Emitted when the remove button is clicked.
 * @emit {Event} click:edit - Emitted when the edit button is clicked.
 */
import { inject } from "vue";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * INJECT COMPOSABLES
 *****************************************************************************/
const { getWorker } = inject("workersListComposable");
const { has } = inject("timedSetComposable");
const { current } = inject("tagSizeComposable");

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  /** Whether the tag is in loading state. */
  loading: { type: Boolean, default: false },
  /** The schedule object associated with the worker. */
  schedule: { type: Object, default: false },
  /** The worker object. */
  worker: { type: Object, required: true },
  /** Visual variant of the tag */
  variant: {
    type: String,
    default: "default",
    validator: (value) =>
      ["default", "success", "warning", "error", "disabled"].includes(value),
  },
});

const emit = defineEmits(["click:remove", "click:edit"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return getWorker(props.worker)?.displayName;
});

const hasStartTimeDifference = computed(() => {
  return props.schedule.startTime !== props.worker.startTime;
});

const hasEndTimeDifference = computed(() => {
  return props.schedule.endTime !== props.worker.endTime;
});
</script>

<template>
  <MoleculesWorkerTag
    :amount="worker.amount"
    :end-time="worker.endTime"
    :highlight="has(worker.workerId)"
    :label="label"
    :loading="loading"
    :removable="schedule.isEditable"
    :size="current"
    :start-time="worker.startTime"
    :variant="variant"
    @click:remove="emit('click:remove')"
  >
    <!-- add draggable icon to prepend-label slot -->
    <template #prepend-label>
      <AtomsIconsDraggable v-if="schedule.isEditable" />
    </template>

    <!-- add notification chip to prepend-action slot -->
    <template #prepend-action>
      <ArrangementsNotificationChip
        v-if="schedule.isEditable"
        :schedule-id="schedule.docId"
        :worker-id="worker.workerId"
      />
    </template>

    <!-- custom startTime if worker's startTime is different from schedule -->
    <template v-if="hasStartTimeDifference" #startTime="{ startTime }">
      <span class="text-red">{{ startTime }}</span>
    </template>

    <!-- custom endTime if worker's endTime is different from schedule -->
    <template v-if="hasEndTimeDifference" #endTime="{ endTime }">
      <span class="text-red">{{ endTime }}</span>
    </template>

    <template #append-footer>
      <v-icon
        class="ml-2"
        icon="mdi-pencil"
        size="x-small"
        @click="emit('click:edit', { schedule, worker })"
      />
    </template>
  </MoleculesWorkerTag>
</template>

<style scoped></style>
