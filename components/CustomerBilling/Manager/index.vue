<script setup>
/*******************************************************************************
 * @file components/CustomerBilling/Manager/index.vue
 * @description Billing 一件を通常更新する AirItemManager ラッパー
 ******************************************************************************/
import { Billing } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/CustomerBilling/CustomInput.vue";
import { assertPaymentDueDate } from "@/composables/domain/customerBilling/paymentDueDateValidation.js";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerBillingManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  modelValue: {
    type: Object,
    default: () => new Billing(),
    validator: (value) => value instanceof Billing,
  },
});

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("CustomerBillingManager");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * 新規作成・削除はサポートしないことを示すエラーを投げる
 */
function rejectUnsupportedOperation() {
  throw new Error("この画面では請求の新規作成・削除は実行できません。");
}

/**
 * AirItemManager の beforeEdit に渡す関数
 * - 新規作成・削除はサポートしない。
 * - `UPDATE` モードの場合は props.beforeEdit を呼び出す。
 * @param editMode
 * @param item
 */
async function beforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return rejectUnsupportedOperation();
  return await props.beforeEdit(editMode, item);
}

/**
 * AirItemManager の handleUpdate に渡す関数
 * - 入金予定日が請求日より前の日付になっていないかを検証する
 * @param draft
 */
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
    :custom-input="props.customInput || CustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
