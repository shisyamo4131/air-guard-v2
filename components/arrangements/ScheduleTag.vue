<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedule.
 *
 * @props {Object} schedule - A `SiteOperationSchedule` instance.
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
 * @emits {event} click:remove-worker - Emitted when the remove button is clicked on a worker tag.
 *                                      Event payload: { schedule: Object, workerId: string, isEmployee: boolean }
 *                                      - schedule: The current SiteOperationSchedule instance
 *                                      - workerId: The ID of the worker to remove
 *                                      - isEmployee: Whether the worker is an employee (true) or outsourcer (false)
 * @emits {event} click:notification - Emitted when the notification chip is clicked
 *                                     Event payload: Forwarded from ArrangementsWorkerTag component
 */
import DraggableIcon from "@/components/atoms/icons/Draggable.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  schedule: { type: Object, required: true },
});

const emit = defineEmits([
  "click:duplicate",
  "click:edit",
  "click:edit-worker",
  "click:notify",
  "click:notification",
  "click:remove-worker",
  "change:workers",
]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return props.schedule?.workDescription || "通常警備";
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
    <ArrangementsDraggableWorkers
      :schedule="schedule"
      @change="emit('change:workers', $event)"
      @click:remove="emit('click:remove-worker', $event)"
      @click:edit="emit('click:edit-worker', $event)"
      @click:notification="emit('click:notification', $event)"
    />
    <v-container
      class="d-flex justify-end pt-0 pb-2 px-2"
      style="column-gap: 4px"
    >
      <!-- 通知ボタン -->
      <v-btn
        :disabled="!schedule.isEditable || schedule.isNotificatedAllWorkers"
        variant="tonal"
        size="x-small"
        @click="emit('click:notify')"
      >
        <v-icon>mdi-bullhorn</v-icon>
      </v-btn>
      <!-- 複製ボタン -->
      <v-btn variant="tonal" size="x-small" @click="emit('click:duplicate')">
        <v-icon>mdi-content-copy</v-icon>
      </v-btn>

      <!-- 編集ボタン -->
      <v-btn
        :disabled="!schedule.isEditable"
        variant="tonal"
        size="x-small"
        @click="emit('click:edit')"
      >
        <v-icon>mdi-pencil</v-icon>
      </v-btn>
    </v-container>
  </v-card>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
</style>
