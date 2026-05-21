<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Workers/Manager/index.vue
 * @description A component to manage `OperationResultDetail`.
 * @extends WorkersManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResultDetail } from "@/schemas";
// COMPONENTS
import CustomInput from "@/components/OperationResult/Worker/CustomInput.vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationResultWorkersManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
});
const props = useDefaults(_props, "OperationResultWorkersManager");
</script>

<template>
  <air-array-manager
    v-bind="$attrs"
    :schema="OperationResultDetail"
    item-key="workerId"
    :table-props="{ hideSearch: true }"
    :custom-input="props.customInput"
  >
    <template #table="tableProps">
      <OperationResultWorkersDataTable v-bind="tableProps" />
    </template>
  </air-array-manager>
</template>
