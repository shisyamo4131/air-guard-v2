<script setup>
/*****************************************************************************
 * @file components/CustomerBillings/Manager/index.vue
 * @description 取引先請求を管理するAirArrayManager拡張コンポーネントです。
 * @extends AirArrayManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Billing } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/customerBillingHandlers";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerBillingsManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
});
const props = useDefaults(_props, "CustomerBillingsManager");

/*****************************************************************************
 * SETUP BASE MANAGER COMPOSABLE
 *****************************************************************************/
const { attrs } = useBaseManager("CustomerBillingsManager");
</script>

<template>
  <AirArrayManager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.docs"
    :schema="Billing"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </AirArrayManager>
</template>
