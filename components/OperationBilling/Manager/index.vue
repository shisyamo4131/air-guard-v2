<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Manager/index.vue
 * @description A component to manage a `OperationBilling` document.
 * @extends AirItemManager
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
defineOptions({ name: "OperationBillingManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationBilling,
  },
  customInput: { type: Object, default: () => CustomInput },
});
const props = useDefaults(_props, "OperationBillingManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationBillingManager");

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
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.doc"
    :handle-create="handleCreate"
    :handle-update="(item) => item.update()"
    :handle-delete="handleDelete"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
