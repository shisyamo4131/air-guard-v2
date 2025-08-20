<script setup>
/**
 * @file components/molecules/draggable/Workers.vue
 * @description A component for draggable worker items.
 * An element in `model-value` must be an instance of `OperationResultDetail`.
 * Since workers cannot be duplicated, if the same worker already exists,
 * the drop process is prevented and the corresponding worker is highlighted.
 *
 * @props {Array} modelValue - The array of workers to be displayed.
 * @props {String} date - The date for which workers are arranged.
 * @props {Boolean} disabled - Whether the draggable area is disabled.
 * @props {String} itemKey - Unique key for each item, defaults to 'workerId'.
 * @props {String} name - Group name for vuedraggable, defaults to 'workers'.
 *
 * note: Do not use `v-model` at vuedraggable.
 *       Optimistic update should not be used due to employee-outsourcer order limitation.
 * @emits click:remove - Event to remove a worker from the arrangement.
 * @emits update:status - Event to update the status of a worker.
 */
import { computed } from "vue";
import draggable from "vuedraggable";
import { useTimedSet } from "@/composables/useTimedSet";

// /** define model-value and emit `update:model-value`. */
// const workers = defineModel({ type: Array, default: () => [] });

/** define props */
const props = defineProps({
  /** Whether the draggable area is disabled */
  disabled: { type: Boolean, default: false },
  /** unique key for each item */
  itemKey: { type: String, default: "workerId" },
  /** group name for vuedraggable */
  name: { type: String, default: "workers" },
  /** An array of worker instances for vuedraggable */
  workers: { type: Array, required: true },
});

/** define emits */
const emit = defineEmits([
  "click:remove",
  "update:status",
  "add-worker",
  "remove-worker",
  "change-worker",
]);

/** define composables */
const { add: highlightEmployee, has: isHighlighted } = useTimedSet({
  timeout: 2000,
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const group = computed(() => ({
  name: props.name,
  put: handlePut,
}));

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * vuedraggable の put イベントハンドラ
 * Validates drag and drop operations and highlights existing employees
 */
function handlePut(to, from, dragEl) {
  // 同一グループからの要素のみ受け入れ
  const fromGroupName =
    from.el.getAttribute("data-group") || from.options?.group?.name;
  if (fromGroupName !== props.name) return false;

  const element = dragEl.__draggable_context.element;
  if (!element) return false;

  // 外注先の場合は許可（重複チェック不要）
  if (!element.isEmployee) return true;

  const workerId = element[props.itemKey];
  if (!workerId) return false;

  // 既に配置されている従業員かどうかをチェック
  const isExisting = workers.value.some(
    (emp) => emp[props.itemKey] === workerId
  );

  if (isExisting) {
    highlightEmployee(workerId);
    return false;
  }

  return true;
}

function handleUpdateStatus(worker, newVal) {
  emit("update:status", { worker, status: newVal });
}

function handleWorkerAdded(addedEvent) {
  const { workerId, isEmployee, amount } = addedEvent.element;
  emit("add-worker", {
    workerId,
    isEmployee,
    amount,
    newIndex: addedEvent.newIndex,
  });
}

function handleWorkerRemoved(removedEvent) {
  const { workerId, isEmployee, amount } = removedEvent.element;
  emit("remove-worker", { workerId, isEmployee, amount });
}

function handleWorkerMoved(movedEvent) {
  const { isEmployee } = movedEvent.element;
  emit("change-worker", {
    oldIndex: movedEvent.oldIndex,
    newIndex: movedEvent.newIndex,
    isEmployee,
  });
}

/**
 * vuedraggable の change ハンドラ
 * @param event
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
    :group="group"
    :item-key="itemKey"
    handle=".drag-handle"
    @change="handleChange"
  >
    <template #item="props">
      <div>
        <!-- item slot for `WorkerTag` -->
        <slot name="item" v-bind="props" />
      </div>
    </template>
  </draggable>
</template>
