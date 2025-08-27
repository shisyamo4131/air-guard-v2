<script setup>
/**
 * @file components/arrangements/DraggableWorkers.vue
 * @description A component for draggable worker items.
 * Since workers cannot be duplicated, if the same worker already exists,
 * the drop process is prevented and the corresponding worker is highlighted.
 *
 * @props {Boolean} disabled - Whether the draggable area is disabled.
 * @props {Object} schedule - A `SiteOperationSchedule` instance.
 * @props {String} tagSize - Tag size for worker elements.
 * @props {Array} workers - An array of worker objects for vuedraggable.
 */
import draggable from "vuedraggable";
import { useTimedSet } from "@/composables/useTimedSet";

const DRAGGABLE_GROUP_NAME = "workers";
const DRAGGABLE_ITEM_KEY = "workerId";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * INJECT COMPOSABLES
 *****************************************************************************/
const { addWorker, changeWorker, removeWorker } = inject("managerComposable");

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  /** Whether the draggable area is disabled */
  disabled: { type: Boolean, default: false },
  /** A `SiteOperationSchedule` instance */
  schedule: { type: Object, required: true },
  /** Tag size for worker elements */
  tagSize: { type: String, default: "medium" },
  /** An array of worker objects for vuedraggable */
  workers: { type: Array, required: true },
});

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { add: highlightEmployee, has: isHighlighted } = useTimedSet({
  timeout: 2000,
});

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
 * - Set `workerId` to `useSetTimer` composable and returns false
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
  const isExisting = props.workers.some(
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
 * Handles the addition of a worker.
 * - Call `addWorker` method provided by the managerComposable.
 * @param {Object} event - The event object containing information about the added worker.
 */
function handleWorkerAdded(event) {
  const { element, newIndex } = event;
  const { workerId, isEmployee, amount } = element;
  const schedule = props.schedule;
  addWorker({ schedule, workerId, isEmployee, amount, newIndex });
}

/**
 * Handles the removal of a worker.
 * - Call `removeWorker` method provided by the managerComposable.
 * @param {Object} event - The event object containing information about the removed worker.
 */
function handleWorkerRemoved(event) {
  const { workerId, isEmployee } = event.element;
  const schedule = props.schedule;
  removeWorker({ schedule, workerId, isEmployee });
}

/**
 * Handles the movement of a worker.
 * - Call `changeWorker` method provided by the managerComposable.
 * @param {Object} event - The event object containing information about the moved worker.
 */
function handleWorkerMoved(event) {
  const { element, oldIndex, newIndex } = event;
  const { isEmployee } = element;
  const schedule = props.schedule;
  changeWorker({ schedule, oldIndex, newIndex, isEmployee });
}

/**
 * An event handler for vuedraggable's change event.
 * @param {Object} event - The change event from vuedraggable.
 */
function handleChange(event) {
  if (event.added) {
    handleWorkerAdded(event.added);
  } else if (event.removed) {
    handleWorkerRemoved(event.removed);
  } else if (event.moved) {
    handleWorkerMoved(event.moved);
  }
}
</script>

<template>
  <draggable
    :model-value="workers"
    class="pa-2"
    style="min-height: 24px"
    :disabled="disabled"
    :group="{
      name: DRAGGABLE_GROUP_NAME,
      put: handlePut,
    }"
    :item-key="DRAGGABLE_ITEM_KEY"
    handle=".drag-handle"
    @change="handleChange"
  >
    <template #item="{ element }">
      <div>
        <!-- item slot for `WorkerTag` -->
        <slot
          name="item"
          v-bind="{
            disabled,
            highlight: isHighlighted(element.workerId),
            schedule,
            size: tagSize,
            worker: element,
            'onClick:remove': () => {
              handleWorkerRemoved({
                element: {
                  workerId: element.workerId,
                  isEmployee: element.isEmployee,
                  amount: element.amount,
                },
              });
            },
          }"
        />
      </div>
    </template>
  </draggable>
</template>
