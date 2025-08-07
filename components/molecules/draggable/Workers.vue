<script setup>
/**
 * @file @/components/molecules/draggable/Workers.vue
 * @description A component for draggable worker items.
 * An element in `model-value` must be an instance of `OperationResultDetail`.
 */
import { computed } from "vue";
import draggable from "vuedraggable";
import { useTimedSet } from "@/composables/useTimedSet";

/** define props */
const props = defineProps({
  /** unique key for each item */
  itemKey: { type: String, default: "workerId" },
  /** group name for vuedraggable */
  name: { type: String, default: "workers" },
});

/** define model-value and emit `update:model-value`. */
const model = defineModel({ type: Array, default: () => [] });

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
  const isExisting = model.value.some((emp) => emp[props.itemKey] === workerId);

  if (isExisting) {
    highlightEmployee(workerId);
    return false;
  }

  return true;
}
</script>

<template>
  <draggable
    v-model="model"
    class="pa-2"
    style="min-height: 24px"
    :group="group"
    :item-key="itemKey"
  >
    <template #item="{ element }">
      <div>
        <slot
          name="default"
          :element="element"
          :highlighted="isHighlighted(element[itemKey])"
        />
      </div>
    </template>
  </draggable>
</template>
