<script setup>
/*******************************************************************************
 * @file components/CustomerBilling/CustomInput.vue
 * @description 顧客請求の入金予定日を通常更新するための入力部品
 ******************************************************************************/
import { computed } from "vue";
import { dateInput } from "@/composables/domain/shared/valueContract.js";

const props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
  disabled: { type: Boolean, default: false },
  editMode: { type: String, default: "UPDATE" },
});

const billingDate = computed(() => {
  try {
    return dateInput(props.item.billingDateAt);
  } catch {
    return undefined;
  }
});

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
        :min="billingDate"
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
