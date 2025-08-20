<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedules.
 *
 * @props {Array} modelValue - An array of `SiteOperationSchedule` instances.
 * @props {String} handle - Class name for vuedraggable's handle property.
 * @props {String} itemKey - Unique identifier key (default: 'docId').
 *
 * @emits update:model-value - Event to update the model value with new schedules.
 *
 * @slots
 * - default: Renders individual schedule items with provided props.
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
});

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
    <template #item="props">
      <div>
        <slot name="item" v-bind="props" />
      </div>
    </template>
  </draggable>
</template>
