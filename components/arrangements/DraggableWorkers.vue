<script setup>
/**
 * @file components/arrangements/DraggableWorkers.vue
 * @description A component for draggable worker items.
 * Since workers cannot be duplicated, if the same worker already exists,
 * the drop process is prevented and the corresponding worker is highlighted.
 *
 * @prop {Object} notifications - An object containing arrangement notifications.
 * @prop {Object} schedule - A `SiteOperationSchedule` instance.
 *
 * @emits {Event} click:edit - Emitted when the edit button is clicked on a worker tag.
 *                             Event payload: { schedule: Object, worker: Object }
 *                             - schedule: The current SiteOperationSchedule instance
 *                             - worker: The worker element being edited
 * @emits {Event} click:remove - Emitted when the remove button is clicked on a worker tag.
 *                               Event payload: { schedule: Object, workerId: string, isEmployee: boolean }
 *                               - schedule: The current SiteOperationSchedule instance
 *                               - workerId: The ID of the worker to remove
 *                               - isEmployee: Whether the worker is an employee (true) or outsourcer (false)
 * @emits {Event} change - Emitted when the order of workers changes.
 *                         Event payload: { event: Object, schedule: Object }
 *                         - event: The vuedraggable change event
 *                         - schedule: The current SiteOperationSchedule instance
 * @emits {Event} click:notification - Emitted when the notification button is clicked.
 *                                     Event payload: Forwarded from ArrangementsWorkerTag component
 */
import draggable from "vuedraggable";
import { useTimedSet } from "@/composables/useTimedSet";

const DRAGGABLE_GROUP_NAME = "workers";
const DRAGGABLE_ITEM_KEY = "workerId";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  notifications: { type: Object, default: () => ({}) },
  schedule: { type: Object, required: true },
});

const emit = defineEmits([
  "click:edit",
  "click:remove",
  "change",
  "click:notification",
]);

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const timedSetComposable = useTimedSet({ timeout: 2000 });
const { add: highlightEmployee } = timedSetComposable;
provide("timedSetComposable", timedSetComposable);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * A `put` event handler for the vuedraggable.
 * - Returns false if the element from a different group is dropped.
 * - Returns false if could not obtain a element from dragging element context.
 * - Returns false if the element does not have a property defined as DRAGGABLE_ITEM_KEY.
 * - Returns true if the element's `isEmployee` property is false. (It means the element is outsourcer)
 * - Set `workerId` to `useTimedSet` composable and returns false
 *   if the worker (employee) already exists in `workers`.
 * - Returns true for all other cases.
 */
function handlePut(to, from, dragEl) {
  // Get the group name of the source list.
  const fromGroupName =
    from.el.getAttribute("data-group") || from.options?.group?.name;

  // Returns false if the element from a different group is dropped.
  if (fromGroupName !== DRAGGABLE_GROUP_NAME) return false;

  // Get the `context-element` and return false if it does not exist.
  const element = dragEl.__draggable_context.element;
  if (!element) return false;

  // Returns true if the element's `isEmployee` property is false. (It means the element is outsourcer)
  if (!element.isEmployee) return true;

  // Get the worker ID and return false if it does not exist.
  const workerId = element[DRAGGABLE_ITEM_KEY];
  if (!workerId) return false;

  // Check if the worker (employee) already exists in `workers`.
  const isExisting = props.schedule.workers.some(
    (emp) => emp[DRAGGABLE_ITEM_KEY] === workerId
  );

  // If the worker (employee) already exists in `workers`, highlight it and return false.
  if (isExisting) {
    highlightEmployee(workerId);
    return false;
  }

  return true;
}

/**
 * An event handler for vuedraggable's change event.
 * @param {Object} event - The change event from vuedraggable.
 */
function handleChange(event) {
  emit("change", { event, schedule: props.schedule });
}

/**
 * Handler for `click:edit` event from `ArrangementsWorkerTag` component.
 * @param {Object} element - The worker element to edit.
 */
function handleClickEdit(element) {
  emit("click:edit", {
    schedule: props.schedule,
    worker: element,
  });
}

/**
 * Handler for `click:notification` event from `ArrangementsWorkerTag` component.
 * @param {Object} event - The notification event.
 */
function handleClickNotification(event) {
  emit("click:notification", event);
}

/**
 * Handler for `click:remove` event from `ArrangementsWorkerTag` component.
 * @param {Object} element - The worker element to remove.
 */
function handleClickRemove(element) {
  emit("click:remove", {
    schedule: props.schedule,
    workerId: element.workerId,
    isEmployee: element.isEmployee,
  });
}
</script>

<template>
  <draggable
    :model-value="schedule.workers"
    class="pa-2"
    style="min-height: 24px"
    :disabled="!schedule.isEditable"
    :group="{ name: DRAGGABLE_GROUP_NAME, put: handlePut }"
    :item-key="DRAGGABLE_ITEM_KEY"
    handle=".drag-handle"
    @change="handleChange"
  >
    <template #item="{ element }">
      <div>
        <ArrangementsWorkerTag
          :schedule="schedule"
          :notification="notifications[element.notificationKey]"
          :worker="element"
          @click:edit="handleClickEdit(element)"
          @click:notification="handleClickNotification"
          @click:remove="handleClickRemove(element)"
        />
      </div>
    </template>
  </draggable>
</template>
