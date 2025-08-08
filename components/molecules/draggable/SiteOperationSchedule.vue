<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedule.
 * It allows users to drag and drop schedule (SiteOperationSchedule) for a specific site and shift type.
 * Only allows dragging if the schedule status is a draft.
 * Drag and drop is restricted to the same site and shift type.
 *
 * @props {String} siteId - The ID of the site for which schedules are being managed.
 * @props {String} shiftType - The type of shift for which schedules are being managed.
 *
 * @slots
 * - default: Slot for rendering the schedule item.
 */
import draggable from "vuedraggable";

/** define props */
const props = defineProps({
  itemKey: { type: String, default: "docId" },
  siteId: { type: String, required: true },
  shiftType: { type: String, required: true },
  date: { type: String, required: true },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const name = computed(() => `schedules-${props.siteId}-${props.shiftType}`);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Determines whether an item can be dragged from one list to another.
 * Only allows dragging if the schedule status is a draft.
 *
 * @param {HTMLElement} to - The target container element.
 * @param {HTMLElement} from - The source container element.
 * @param {HTMLElement} dragEl - The element being dragged.
 * @returns {boolean} True if the schedule is a draft, otherwise false.
 */
function pull(to, from, dragEl) {
  const schedule = dragEl.__draggable_context.element;
  return schedule.isScheduleChangeable;
}
</script>

<template>
  <draggable
    class="d-flex flex-column fill-height pa-2"
    :item-key="itemKey"
    :group="{ name, pull }"
  >
    <template #item="{ element }">
      <div>
        <slot
          name="default"
          :element="element"
          :site-id="siteId"
          :shift-type="shiftType"
          :date="date"
        />
      </div>
    </template>
  </draggable>
</template>
