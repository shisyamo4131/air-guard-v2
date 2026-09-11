<script setup>
/*****************************************************************************
 * @file components/Customer/Manager/index.vue
 * @description AirItemManagerを使った取引先通常作成・更新コンポーネント
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => new Customer(),
    validator: (value) => value instanceof Customer,
  },
});

const emit = defineEmits(["created"]);

const { attrs } = useBaseManager("CustomerManager");

function rejectUnsupportedOperation() {
  throw new Error("この画面では指定された取引先操作を実行できません。");
}

function beforeEdit(editMode) {
  if (editMode === "DELETE") {
    return rejectUnsupportedOperation();
  }
  return true;
}

async function handleUpdate(draft) {
  return await draft.update();
}

async function handleCreate(draft) {
  return await draft.create();
}
</script>

<template>
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.modelValue"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': $attrs.label,
    }"
    :before-edit="beforeEdit"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @create="emit('created', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
