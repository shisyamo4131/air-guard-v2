<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedules.
 *
 * @prop {Array} modelValue - An array of `SiteOperationSchedule` instances.
 * @prop {String} handle - Class name for vuedraggable's handle property.
 * @prop {String} itemKey - Unique identifier key (default: 'docId').
 * @prop {Object} notifications - An object containing arrangement notifications.
 * @prop {String} siteId - The ID of the site.
 * @prop {String} shiftType - The type of shift.
 *
 * @emits {void} update:model-value - Event to update the model value with new schedules.
 * @emits {void} change:workers - Emitted when the order of workers changes.
 * @emits {void} click:duplicate - Emitted when the duplicate button is clicked
 * @emits {void} click:edit - Emitted when the edit button is clicked
 * @emits {void} click:edit-worker - Emitted when the edit button is clicked on a worker tag.
 * @emits {void} click:edit-workers - Emitted when the `account-edit` button is clicked.
 * @emits {void} click:notify - Emitted when the notify button is clicked
 * @emits {void} click:notification - Emitted when the notification chip is clicked
 *
 * @deprecated
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
  handle: { type: String, default: ".drag-handle" },
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
  "click:edit-workers", // 2025-12-24 add
  "click:notify",
  "click:notification",
]);
/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const name = computed(() => `schedules`);

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
          @click:edit-workers="emit('click:edit-workers', element)"
          @click:notify="emit('click:notify', element)"
          @click:notification="emit('click:notification', $event)"
        >
        </ArrangementsScheduleTag>
      </div>
    </template>
  </draggable>
</template>
