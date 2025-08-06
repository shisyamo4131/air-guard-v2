<script setup>
/**
 * @file DraggableSiteSchedules.vue
 * @description A component based on vuedraggable that allows users to rearrange schedules for a specific site and shift type.
 *
 * @prop {String} siteId - The ID of the site for which schedules are being managed.
 * @prop {String} shiftType - The type of shift.
 * @prop {Array} schedules - The list of schedules to be displayed and managed.
 *
 * @emits {Function} click:edit - Emitted when a edit-button is clicked for editing.
 */
import { inject } from "vue";
import draggable from "vuedraggable";

/** define model */
const schedules = defineModel();

/** define props */
const props = defineProps({
  siteId: { type: String, required: true },
  shiftType: { type: String, required: true },
});

/** inject from ancestor */
const managerComposable = inject("scheduleManagerComposable");
const { cachedEmployees, cachedOutsourcers } = managerComposable;

/** define emits */
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const draggableName = computed(
  () => `schedules-${props.siteId}-${props.shiftType}`
);

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
    v-model="schedules"
    item-key="docId"
    class="d-flex flex-column fill-height pa-2"
    :group="{ name: draggableName, pull }"
  >
    <template #item="{ element: schedule }">
      <ArrangementsScheduleTag
        :schedule="schedule"
        :cached-employees="cachedEmployees"
        :cached-outsourcers="cachedOutsourcers"
        class="mb-2"
        @click:edit="emit('click:edit', $event)"
      />
    </template>
  </draggable>
</template>
