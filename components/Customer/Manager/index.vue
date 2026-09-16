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

function beforeEdit(editMode) {
  return true;
}

async function handleUpdate(draft) {
  return await draft.update();
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleDelete(draft) {
  return await draft.delete();
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
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @create="emit('created', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
