<script setup>
/*******************************************************************************
 * @file components/CustomerBilling/CustomInput.vue
 * @description 顧客請求の入金予定日を通常更新するための入力部品
 ******************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
  disabled: { type: Boolean, default: false },
  editMode: { type: String, default: "UPDATE" },
});
const props = useDefaults(_props, "CustomerBillingCustomInput");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * props.updateProperties を使って入金予定日を未設定にする
 */
function clearPaymentDueDate() {
  props.updateProperties({ paymentDueDateAt: null });
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <air-date-input
        v-bind="props.componentAttrs.paymentDueDateAt"
        label="入金予定日"
        :min="props.item.billingDate"
        :disabled="props.disabled || props.editMode !== 'UPDATE'"
      />
    </v-col>
    <v-col cols="12">
      <v-btn
        text="未設定にする"
        :disabled="props.disabled || props.editMode !== 'UPDATE'"
        @click="clearPaymentDueDate"
      />
    </v-col>
  </v-row>
</template>
