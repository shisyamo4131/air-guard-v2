<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedules.
 * It allows users to drag and drop schedules within the same site and shift type.
 * Only draft schedules can be dragged based on isScheduleChangeable property.
 *
 * @props {String} date - The date for schedule management.
 * @props {String} itemKey - Unique identifier key (default: 'docId').
 * @props {String} shiftType - The shift type for schedule grouping.
 * @props {String} siteId - The site ID for schedule grouping.
 *
 * @slots
 * - default: Renders individual schedule items with provided props.
 */
import draggable from "vuedraggable";

/** define model-value and emit `update:model-value` */
const schedules = defineModel({ type: Array, required: true });

/** define props */
const props = defineProps({
  /** The date for which schedules are being managed */
  date: { type: String, required: true },
  /** Unique key for each item */
  itemKey: { type: String, default: "docId" },
  /** The type of shift for which schedules are being managed */
  shiftType: { type: String, required: true },
  /** The ID of the site for which schedules are being managed */
  siteId: { type: String, required: true },
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
    :item-key="itemKey"
    :group="{ name }"
    handle=".drag-handle"
  >
    <template #item="{ element: schedule }">
      <div>
        <slot
          name="default"
          v-bind="{
            modelValue: schedule,
            schedule,
            siteId,
            shiftType,
            date,
          }"
        />
      </div>
    </template>
  </draggable>
</template>
