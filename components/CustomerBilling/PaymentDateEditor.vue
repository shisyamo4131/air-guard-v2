<script setup>
import { computed } from "vue";
import { useBillingPaymentDate } from "@/composables/application/customerBilling/useBillingPaymentDate";
import { dateInput } from "@/functions/shared/employeeContract.js";
const props = defineProps({ documentId: { type: String, required: true } });
const editor = useBillingPaymentDate(computed(() => props.documentId));
const disabled = computed(() => editor.busy.value || editor.uncertain.value || editor.conflict.value);
</script>
<template>
  <v-btn class="ml-2" color="secondary" prepend-icon="mdi-pencil" size="small" text="変更" aria-label="入金予定日を変更" :disabled="!editor.allowed.value || editor.busy.value" @click="editor.open" />
  <v-alert v-if="editor.message.value" class="mt-2" density="compact" type="info">{{ editor.message.value }}</v-alert>
  <v-dialog :model-value="editor.visible.value" :persistent="editor.busy.value" max-width="480" @update:model-value="(value) => { if (!value) editor.close(); }">
    <v-card title="入金予定日編集">
      <v-card-text>
        <v-text-field label="入金予定日" type="date" :model-value="editor.value.value || ''" :min="editor.baseline.value ? dateInput(editor.baseline.value.billingDateAt) : undefined" :disabled="disabled || !editor.baseline.value" @update:model-value="editor.setValue" />
        <v-btn text="未設定にする" :disabled="disabled || !editor.baseline.value" @click="editor.setValue(null)" />
        <v-alert v-if="editor.message.value" class="mt-2" density="compact" type="info">{{ editor.message.value }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn text="閉じる" :disabled="editor.busy.value" @click="editor.close" />
        <v-btn text="再読込" :disabled="editor.busy.value" @click="editor.reload" />
        <v-spacer />
        <v-btn text="保存" color="primary" :disabled="disabled || !editor.baseline.value" :loading="editor.busy.value" @click="editor.save" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
