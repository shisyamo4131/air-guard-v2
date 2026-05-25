<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Workers/Manager/index.vue
 * @description A component to manage `OperationResultDetail`.
 * @extends WorkersManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResultDetail } from "@/schemas";
// COMPOSABLES
import { useBaseManager } from "@/composables/useBaseManager";
// COMPONENTS
import CustomInput from "@/components/OperationResult/Worker/CustomInput.vue";
import Toolbar from "./Toolbar.vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationResultWorkersManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  tableProps: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "OperationResultWorkersManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationResultWorkersManager");
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :schema="OperationResultDetail"
    item-key="workerId"
    :table-props="{ ...props.tableProps, hideSearch: true }"
    :custom-input="props.customInput"
  >
    <template #table="tableProps">
      <Toolbar v-bind="tableProps" />
      <OperationResultWorkersDataTable v-bind="tableProps" />
    </template>
  </air-array-manager>
</template>
