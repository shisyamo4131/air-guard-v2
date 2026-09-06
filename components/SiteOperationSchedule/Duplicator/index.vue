<script setup>
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: Boolean, selectedDates: { type: Array, default: () => [] }, allowedDates: { type: Function, default: () => true }, disabled: Boolean, loading: Boolean, blocked: Boolean, error: { type: String, default: "" } });
const emit = defineEmits(["update:modelValue", "update:selected-dates", "submit", "cancel"]);
</script>
<template>
  <v-dialog :model-value="modelValue" persistent width="376">
    <v-card title="予定複製">
      <v-alert v-if="error" type="warning">{{ error }}</v-alert>
      <v-date-picker :model-value="selectedDates" :allowed-dates="allowedDates" :disabled="loading || blocked" hide-header multiple @update:model-value="emit('update:selected-dates', $event)" />
      <v-card-actions>
        <v-btn :disabled="loading" @click="emit('cancel')">取消</v-btn>
        <v-btn :disabled="disabled" :loading="loading" color="primary" @click="emit('submit')">複製</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
