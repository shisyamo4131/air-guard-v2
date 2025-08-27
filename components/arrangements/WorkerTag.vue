<script setup>
/**
 * @file components/arrangements/WorkerTag.vue
 * @description A component for displaying a arrangemented worker tag.
 *
 * @props {Boolean} disabled - Whether the tag is disabled.
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Object} schedule - The schedule object associated with the worker.
 * @props {String} size - The size variant of the tag.
 * @props {Object} worker - The worker object containing relevant information.
 * @props {String} variant - The visual variant of the tag.
 */
import { inject } from "vue";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * INJECT COMPOSABLES
 *****************************************************************************/
const { getWorker } = inject("workersListComposable");

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  disabled: { type: Boolean, default: false },
  /** Whether the tag is highlighted. */
  highlight: { type: Boolean, default: false },
  /** Whether the tag is in loading state. */
  loading: { type: Boolean, default: false },
  schedule: { type: Object, default: false },
  /** Size variant of the tag */
  size: {
    type: String,
    default: "medium",
    validator: (value) => ["small", "medium", "large"].includes(value),
  },
  worker: { type: Object, required: true },
  /** Visual variant of the tag */
  variant: {
    type: String,
    default: "default",
    validator: (value) =>
      ["default", "success", "warning", "error", "disabled"].includes(value),
  },
});

const emit = defineEmits(["click:remove"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return getWorker(props.worker)?.displayName;
});
</script>

<template>
  <MoleculesWorkerTag
    :amount="worker.amount"
    :end-time="worker.endTime"
    :highlight="highlight"
    :label="label"
    :loading="loading"
    :removable="!disabled"
    :show-amount="!worker.isEmployee"
    :size="size"
    :start-time="worker.startTime"
    :variant="variant"
    @click:remove="emit('click:remove')"
  >
    <template #prepend-label>
      <AtomsIconsDraggable v-if="!disabled" />
    </template>
    <template #prepend-action>
      <ArrangementsNotificationChip
        v-if="worker.isEmployee && !disabled"
        :schedule-id="schedule.docId"
        :worker-id="worker.workerId"
      />
    </template>
  </MoleculesWorkerTag>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
</style>
