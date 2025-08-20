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
 * @props {String} shiftType - The shiftType of these workers.
 * @props {String} siteId - The siteId of these workers.
 *
 * note: 'date', 'siteId', and 'shiftType' are not used in this component.
 *       These properties may be needed in the future as the component's functionality is expanded.
 * note: Do not use `v-model` at vuedraggable.
 *       Optimistic update should not be used due to employee-outsourcer order limitation.
 * @emits click:remove - Event to remove a worker from the arrangement.
 * @emits update:status - Event to update the status of a worker.
 */
import { computed } from "vue";
import draggable from "vuedraggable";
import { useTimedSet } from "@/composables/useTimedSet";

/** define model-value and emit `update:model-value`. */
const workers = defineModel({ type: Array, default: () => [] });

/** define props */
const props = defineProps({
  /** The date the workers are arranged */
  date: { type: String, required: true },
  /** Whether the draggable area is disabled */
  disabled: { type: Boolean, default: false },
  /** unique key for each item */
  itemKey: { type: String, default: "workerId" },
  /** group name for vuedraggable */
  name: { type: String, default: "workers" },
  /** The shiftType of this workers */
  shiftType: { type: String, required: true },
  /** The siteId of this workers */
  siteId: { type: String, required: true },
});

/** define emits */
const emit = defineEmits(["click:remove", "update:status"]);

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

/**
 * Handles the click event to remove a worker.
 * @param worker The worker instance to remove.
 */
function handleOnClickRemove(worker) {
  emit("click:remove", { element: worker });
}

function handleUpdateStatus(worker, newVal) {
  emit("update:status", { worker, status: newVal });
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
  >
    <template #item="{ element: worker }">
      <div>
        <!-- default slot for `WorkerTag` -->
        <slot
          name="default"
          v-bind="{
            modelValue: worker,
            key: `${date}-${siteId}-${shiftType}-${worker[itemKey]}`,
            date,
            siteId,
            shiftType,
            isEmployee: worker.isEmployee,
            workerId: worker[props.itemKey],
            highlight: isHighlighted(worker[itemKey]),
            'onClick:remove': handleOnClickRemove,
            'onUpdate:status': ($event) => handleUpdateStatus(worker, $event),
          }"
        />
      </div>
    </template>
  </draggable>
</template>
