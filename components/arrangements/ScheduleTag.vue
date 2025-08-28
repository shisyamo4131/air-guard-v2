<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedule.
 *
 * @props {Object} schedule - A `SiteOperationSchedule` instance.
 * @props {String} tagSize - Tag size for worker elements.
 *
 * @slots
 * - default: Slot for rendering the schedule item.
 */
import DraggableIcon from "@/components/atoms/icons/Draggable.vue";

/*****************************************************************************
 * INJECT COMPOSABLES
 *****************************************************************************/
const { toUpdate } = inject("managerComposable");
const { create } = inject("arrangementNotificationManagerComposable");
const { set } = inject("duplicatorComposable");

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  schedule: { type: Object, required: true },
});

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
    <!--
      default slot for `ArrangementsDraggableWorkers`.
    -->
    <slot name="default" :schedule="schedule" />
    <v-container
      class="d-flex justify-end pt-0 pb-2 px-2"
      style="column-gap: 4px"
    >
      <!-- 通知ボタン -->
      <v-btn
        :disabled="!schedule.isEditable || schedule.isNotificatedAllEmployees"
        variant="tonal"
        size="x-small"
        @click="create(schedule)"
      >
        <v-icon>mdi-bullhorn</v-icon>
      </v-btn>
      <!-- 複製ボタン -->
      <v-btn variant="tonal" size="x-small" @click="set(schedule)">
        <v-icon>mdi-content-copy</v-icon>
      </v-btn>

      <!-- 編集ボタン -->
      <v-btn
        :disabled="!schedule.isEditable"
        variant="tonal"
        size="x-small"
        @click="toUpdate(schedule)"
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
