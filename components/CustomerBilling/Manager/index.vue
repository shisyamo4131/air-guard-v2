<script setup>
/*******************************************************************************
 * @file components/CustomerBilling/Manager/index.vue
 * @description Billing 一件を通常更新する AirItemManager ラッパー
 ******************************************************************************/
import { Billing } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/CustomerBilling/CustomInput.vue";
import { assertPaymentDueDate } from "@/composables/domain/customerBilling/paymentDueDateValidation.js";

defineOptions({ name: "CustomerBillingManager", inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  modelValue: {
    type: Object,
    default: () => new Billing(),
    validator: (value) => value instanceof Billing,
  },
});

const emit = defineEmits(["updated"]);

const { attrs } = useBaseManager("CustomerBillingManager");

function rejectUnsupportedOperation() {
  throw new Error("この画面では請求の新規作成・削除は実行できません。");
}

function resolveCustomInput({ editMode }) {
  if (!props.customInput) return CustomInput;
  return typeof props.customInput === "function"
    ? props.customInput({ editMode })
    : props.customInput;
}

async function beforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return rejectUnsupportedOperation();
  return await props.beforeEdit(editMode, item);
}

async function handleUpdate(draft) {
  assertPaymentDueDate(draft);
  return await draft.update();
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
    :custom-input="resolveCustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @update="emit('updated', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
