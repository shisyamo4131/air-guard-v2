<script setup>
/*****************************************************************************
 * @file ./components/OperationResults/Manager/index.vue
 * @description A component to manage `OperationResults` documents.
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResult } from "@/schemas";
// COMPOSABLES
import { useBaseManager } from "@/composables/useBaseManager";
// COMPONENTS
import CustomInput from "@/components/OperationResult/CustomInput";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every((item) => item instanceof OperationResult),
  },
});
const props = useDefaults(_props, "OperationResultsManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationResultsManager");
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="props.docs"
    :schema="OperationResult"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    :custom-input="CustomInput"
    :disable-delete="(item) => item.isLocked"
    :disable-submit="(item) => item.isLocked"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-array-manager>
</template>
