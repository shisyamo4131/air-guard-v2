<script setup>
/*****************************************************************************
 * @file components/Customer/Manager/index.vue
 * @description AirItemManagerを使った取引先通常CRUD・明示的アーカイブコンポーネント
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  archiveMode: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    default: () => new Customer(),
    validator: (value) => value instanceof Customer,
  },
});

const emit = defineEmits(["created", "updated", "delete"]);

const { attrs } = useBaseManager("CustomerManager");

async function beforeEdit(editMode) {
  if (editMode === "DELETE" && !props.archiveMode) {
    throw new Error("取引先のアーカイブは詳細画面から実行してください。");
  }
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
    :disable-delete="!props.archiveMode"
    :hide-delete-btn="!props.archiveMode"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @create="emit('created', $event)"
    @update="emit('updated', $event)"
    @delete="emit('delete', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
