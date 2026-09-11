<script setup>
/*****************************************************************************
 * @file components/Customers/Manager/index.vue
 * @description AirArrayManagerを使った取引先一覧・選択文脈の管理入口
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
    validator: (value) => value.every((item) => item instanceof Customer),
  },
});

const componentAttrs = useAttrs();
const { attrs } = useBaseManager("CustomersManager");

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return false;
  const externalBeforeEdit =
    componentAttrs.beforeEdit ?? componentAttrs["before-edit"];
  return await externalBeforeEdit?.(editMode, item);
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleUpdate(draft) {
  return await draft.update();
}
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    class="fill-height"
    :model-value="props.modelValue"
    :schema="Customer"
    :excluded-keys="['contractStatus']"
    label="取引先の新規登録"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': '取引先の新規登録',
    }"
    :before-edit="beforeEdit"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
  >
    <template #table="tableAttrs">
      <slot name="table" v-bind="tableAttrs" />
    </template>
  </air-array-manager>
</template>
