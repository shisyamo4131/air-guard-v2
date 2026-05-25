<script setup>
/*****************************************************************************
 * @file ./components/OperationBillings/Manager/index.vue
 * @description A component to manage `OperationBilling` documents.
 * @extends AirArrayManager
 * - `OperationBilling` documents are allowed to be updated but not created or
 *   deleted through this manager, since `OperationBilling` documents should be
 *   managed through `OperationResult` documents.
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";
// COMPOSABLES
import { useBaseManager } from "@/composables/useBaseManager";
// COMPONENTS
import CustomInput from "@/components/OperationBilling/CustomInput/index.vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationBillingsManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every((item) => item instanceof OperationBilling),
  },
});
const props = useDefaults(_props, "OperationBillingsManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationBillingsManager");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Creation of `OperationBilling` is not allowed through this manager.
 * `OperationBilling` document should be created through `OperationResult` document.
 */
function handleCreate() {
  throw new Error("Creation of OperationBilling is not allowed.");
}
/**
 * Deletion of `OperationBilling` is not allowed through this manager.
 * `OperationBilling` document should be deleted through `OperationResult` document.
 */
function handleDelete() {
  throw new Error("Deletion of OperationBilling is not allowed.");
}
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.docs"
    :schema="OperationBilling"
    :handle-create="handleCreate"
    :handle-update="(item) => item.update()"
    :handle-delete="handleDelete"
    :custom-input="CustomInput"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-array-manager>
</template>
