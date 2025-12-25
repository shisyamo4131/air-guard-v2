<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedule.
 *
 * @prop {Object} notifications - An object containing arrangement notifications.
 * @prop {Object} schedule - A `SiteOperationSchedule` instance.
 *
 * @emits {event} change:workers - Emitted when the order of workers changes.
 *                                 Event payload: { event: Object, schedule: Object }
 *                                 - event: The vuedraggable change event
 *                                 - schedule: The current SiteOperationSchedule instance
 * @emits {event} click:duplicate - Emitted when the duplicate button is clicked.
 * @emits {event} click:edit - Emitted when the edit button is clicked
 * @emits {event} click:notify - Emitted when the notify button is clicked
 * @emits {event} click:edit-worker - Emitted when the edit button is clicked on a worker tag.
 *                                    Event payload: { schedule: Object, worker: Object }
 *                                    - schedule: The current SiteOperationSchedule instance
 *                                    - worker: The worker element being edited
 * @emits {event} click:edit-workers - Emitted when the `account-edit` button is clicked.
 * @emits {event} click:notification - Emitted when the notification chip is clicked
 *                                     Event payload: Forwarded from ArrangementsWorkerTag component
 *
 * @deprecated
 * @emits {event} click:remove-worker - Emitted when the remove button is clicked on a worker tag.
 *                                      Event payload: { schedule: Object, workerId: string, isEmployee: boolean }
 *                                      - schedule: The current SiteOperationSchedule instance
 *                                      - workerId: The ID of the worker to remove
 *                                      - isEmployee: Whether the worker is an employee (true) or outsourcer (false)
 */
import DraggableIcon from "@/components/atoms/icons/Draggable.vue";
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  notifications: { type: Object, default: () => ({}) },
  schedule: { type: Object, required: true },
});

const emit = defineEmits([
  "click:duplicate",
  "click:edit",
  "click:edit-worker",
  "click:edit-workers", // 2025-12-23 add
  "click:notify",
  "click:notification",
  // "click:remove-worker",  // Deprecated 2025-12-24
  "change:workers",
]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return props.schedule?.workDescription || "通常警備";
});

const btns = computed(() => {
  const result = [
    // 通知ボタン
    {
      attrs: {
        disabled:
          !props.schedule.isEditable || props.schedule.isNotificatedAllWorkers,
        onClick: () => emit("click:notify"),
      },
      icon: { icon: "mdi-bullhorn" },
    },
    // 複製ボタン
    {
      attrs: {
        onClick: () => emit("click:duplicate"),
      },
      icon: { icon: "mdi-content-copy" },
    },
    // 編集ボタン
    {
      attrs: {
        disabled: !props.schedule.isEditable,
        onClick: () => emit("click:edit"),
      },
      icon: { icon: "mdi-pencil" },
    },
  ];

  return result;
});
</script>

<template>
  <v-card flat style="border: 1px dashed grey; max-width: 100%">
    <div
      class="d-flex text-subtitle-2 font-weight-regular px-3 pt-2 pb-0 align-center"
      style="max-width: 100%"
    >
      <v-badge
        :color="schedule?.isPersonnelShortage ? 'error' : 'primary'"
        :content="schedule?.requiredPersonnel"
        inline
        size="x-small"
      />
      <span class="flex-grow-1 text-truncate" style="min-width: 0">
        {{ `${label}` }}
      </span>
      <DraggableIcon v-if="schedule.isEditable" />
    </div>
    <!-- 2025-12-24 click:remove イベント廃止 -->
    <!-- <ArrangementsDraggableWorkers
      :schedule="schedule"
      :notifications="notifications"
      @change="emit('change:workers', $event)"
      @click:remove="emit('click:remove-worker', $event)"
      @click:edit="emit('click:edit-worker', $event)"
      @click:notification="emit('click:notification', $event)"
    /> -->
    <ArrangementsDraggableWorkers
      :schedule="schedule"
      :notifications="notifications"
      @change="emit('change:workers', $event)"
      @click:edit="emit('click:edit-worker', $event)"
      @click:notification="emit('click:notification', $event)"
    />
    <v-container class="d-flex pt-0 pb-2 px-2 ga-1 justify-end">
      <v-btn
        v-for="(btn, index) of btns"
        :key="index"
        v-bind="btn.attrs"
        size="small"
        variant="tonal"
      >
        <v-icon v-bind="btn.icon" />
      </v-btn>
    </v-container>
  </v-card>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
</style>
