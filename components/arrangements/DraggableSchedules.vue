<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedules.
 *
 * @props {Array} modelValue - An array of `SiteOperationSchedule` instances.
 * @props {String} handle - Class name for vuedraggable's handle property.
 * @props {String} itemKey - Unique identifier key (default: 'docId').
 *
 * @emits {void} update:model-value - Event to update the model value with new schedules.
 * @emits {void} change:workers - Emitted when the order of workers changes.
 * @emits {void} click:duplicate - Emitted when the duplicate button is clicked
 * @emits {void} click:edit - Emitted when the edit button is clicked
 * @emits {void} click:edit-worker - Emitted when the edit button is clicked on a worker tag.
 * @emits {void} click:notify - Emitted when the notify button is clicked
 * @emits {void} click:notification - Emitted when the notification chip is clicked
 * @emits {void} click:remove-worker - Emitted when the remove button is clicked on a worker tag.
 */
import draggable from "vuedraggable";
import { SiteOperationSchedule } from "@/schemas";

/**
 * define model-value and `update:model-value` event.
 * - `update:model-value` event is required for optimistic updates.
 */
const schedules = defineModel({
  type: Array,
  required: true,
  validator: (value) => {
    return (
      value.length === 0 ||
      value.every((item) => item instanceof SiteOperationSchedule)
    );
  },
});

/** define props */
const props = defineProps({
  /** Class name for vuedraggable's handle property */
  handle: { type: String, default: ".drag-handle" },
  /** Unique key for each item */
  itemKey: { type: String, default: "docId" },
  notifications: { type: Object, default: () => ({}) },
  siteId: { type: String, required: true },
  shiftType: { type: String, required: true },
});

const emit = defineEmits([
  "change:workers",
  "click:duplicate",
  "click:edit",
  "click:edit-worker",
  "click:notify",
  "click:notification",
  "click:remove-worker",
]);
/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const name = computed(() => `schedules-${props.siteId}-${props.shiftType}`);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <draggable
    v-model="schedules"
    class="d-flex flex-column fill-height pa-2"
    :group="{ name }"
    :handle="handle"
    :item-key="itemKey"
  >
    <template #item="{ element }">
      <div>
        <ArrangementsScheduleTag
          class="mb-2"
          :schedule="element"
          :notifications="notifications"
          @change:workers="emit('change:workers', $event)"
          @click:duplicate="emit('click:duplicate', element)"
          @click:edit="emit('click:edit', element)"
          @click:edit-worker="emit('click:edit-worker', $event)"
          @click:notify="emit('click:notify', element)"
          @click:notification="emit('click:notification', $event)"
          @click:remove-worker="emit('click:remove-worker', $event)"
        >
        </ArrangementsScheduleTag>
      </div>
    </template>
  </draggable>
</template>
