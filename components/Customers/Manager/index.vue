<script setup>
/*****************************************************************************
 * @file ./components/Customers/Manager/index.vue
 * @description 取引先情報管理コンポーネント
 * @extends AirArrayManager
 *
 * - 詳細画面をまだ有していないために CustomInput も使用していません。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomersManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
});
const props = useDefaults(_props, "CustomersManager");

/*****************************************************************************
 * SETUP BASE MANAGER COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("CustomersManager");
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="docs"
    :schema="Customer"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-array-manager>
</template>
