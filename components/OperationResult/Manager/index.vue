<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Manager/index.vue
 * @description 稼働実績管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResult } from "@/schemas";
// COMPOSABLES
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationResult,
  },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
});
const props = useDefaults(_props, "OperationResultManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationResultManager");
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :disable-delete="(item) => item.isLocked"
    :disable-submit="(item) => item.isLocked"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
