<script setup>
/*****************************************************************************
 * @file components/arrangements/WorkerTag.vue
 * @description A component for displaying an arranged worker tag.
 * - Extends MoleculesWorkerTag with arrangement-specific features.
 * - Shows notification chips, edit buttons, and time differences.
 *
 * @props {Boolean} hideEdit - Whether to hide the edit button.
 * @props {Boolean} hideNotification - Whether to hide the notification chip.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Object} notification - The notification object.
 * @props {Object} schedule - The schedule object associated with the worker.
 * @props {String} variant - Visual variant of the tag ('default', 'success', 'warning', 'error', 'disabled').
 * @props {Object} worker - The worker object containing relevant information.
 *
 * @emits click:remove - Emitted when the remove button is clicked.
 * @emits click:edit - Emitted when the edit button is clicked.
 * @emits click:notification - Emitted when the notification chip is clicked.
 *
 * @update 2025-12-25 Optimized computed properties for better readability.
 * @update 2025-12-25 Removed `amount` prop (deprecated in WorkerTag.vue).
 * @update 2025-12-25 Modified to use `useAuthStore.tagSize` for `WorkerTag.size`.
 *****************************************************************************/
import { computed, inject } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";

defineOptions({ inheritAttrs: false });

const auth = useAuthStore();

/*****************************************************************************
 * INJECT COMPOSABLES
 *****************************************************************************/
const getWorker = inject("getWorker");
const { has } = inject("timedSetComposable");

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  /** Whether to hide the edit button */
  hideEdit: { type: Boolean, default: false },

  /** Whether to hide the notification chip */
  hideNotification: { type: Boolean, default: false },

  /** Whether the tag is in loading state */
  loading: { type: Boolean, default: false },

  /** The notification object */
  notification: { type: Object, default: null },

  /** The schedule object associated with the worker */
  schedule: { type: Object, required: true },

  /** Visual variant of the tag */
  variant: {
    type: String,
    default: "default",
    validator: (value) =>
      ["default", "success", "warning", "error", "disabled"].includes(value),
  },

  /** The worker object containing relevant information */
  worker: { type: Object, required: true },
});

const emit = defineEmits(["click:remove", "click:edit", "click:notification"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Display name of the worker
 */
const label = computed(() => getWorker(props.worker)?.displayName);

/**
 * Whether the worker is highlighted (currently being viewed/edited)
 */
const isHighlighted = computed(() => has(props.worker.workerId));

/**
 * Whether worker's start time differs from schedule
 */
const hasStartTimeDifference = computed(
  () => props.schedule.startTime !== props.worker.startTime
);

/**
 * Whether worker's end time differs from schedule
 */
const hasEndTimeDifference = computed(
  () => props.schedule.endTime !== props.worker.endTime
);

/**
 * Whether to show the edit button
 */
const showEditButton = computed(
  () => !props.hideEdit && props.schedule.isEditable
);

/**
 * Whether to show the notification chip
 */
const showNotification = computed(
  () => !props.hideNotification && props.schedule.isEditable
);
</script>

<template>
  <MoleculesWorkerTag
    :end-time="worker.endTime"
    :highlight="isHighlighted"
    :label="label"
    :loading="loading"
    :removable="schedule.isEditable"
    :size="auth.tagSize"
    :start-time="worker.startTime"
    :variant="variant"
    @click:remove="emit('click:remove')"
  >
    <!-- Draggable and status icons -->
    <template #prepend-label>
      <AtomsIconsDraggable v-if="schedule.isEditable" />
      <AtomsIconsHasLicense v-if="worker.isQualified" />
      <AtomsIconsIsOjt v-if="worker.isOjt" />
    </template>

    <!-- Notification chip -->
    <template v-if="showNotification" #prepend-action>
      <AtomsChipsArrangementNotification
        :notification="notification"
        @click="emit('click:notification', $event)"
      />
    </template>

    <!-- Custom startTime display (red if different from schedule) -->
    <template v-if="hasStartTimeDifference" #startTime="{ startTime }">
      <span class="text-red">{{ startTime }}</span>
    </template>

    <!-- Custom endTime display (red if different from schedule) -->
    <template v-if="hasEndTimeDifference" #endTime="{ endTime }">
      <span class="text-red">{{ endTime }}</span>
    </template>

    <!-- Edit button -->
    <template v-if="showEditButton" #append-footer>
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
