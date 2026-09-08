<script setup>
import { useEmployeeEditor } from "@/composables/application/employee/useEmployeeEditor";
import { operationSchema } from "@/functions/shared/employeeContract.js";
const props = defineProps({
  employee: { type: Object, default: null },
  operation: { type: String, required: true },
  title: { type: String, required: true },
});
const emit = defineEmits(["saved"]);
const editor = useEmployeeEditor({
  operation: props.operation,
  employeeId: () => props.employee?.docId,
});
const {
  opened,
  busy,
  loading,
  conflict,
  uncertain,
  canRetryCreate,
  message,
  draft,
  canWrite,
} = editor;
const schema = operationSchema(props.operation);
const mode = computed(() =>
  props.operation === "create" ? "CREATE" : "UPDATE",
);
const submitDisabled = computed(
  () =>
    loading.value ||
    conflict.value ||
    uncertain.value ||
    !draft.value ||
    !canWrite.value,
);
async function save() {
  const result = await editor.save();
  if (result) emit("saved", result);
}
async function retryCreate() {
  const result = await editor.retryCreate();
  if (result) emit("saved", result);
}
function updateDialog(value) {
  if (value) editor.open();
  else editor.close();
}
</script>
<template>
  <slot
    :open="editor.open"
    :can-edit="
      canWrite && (!employee || employee.employmentStatus === 'ACTIVE')
    "
  />
  <v-alert v-if="message && !opened" type="info" class="my-2">{{
    message
  }}</v-alert>
  <AppEditorDialog
    :model-value="opened"
    :title="title"
    :mode="mode"
    :loading="busy"
    :submit-disabled="submitDisabled"
    @update:model-value="updateDialog"
    @submit="save"
  >
        <v-progress-linear v-if="loading" indeterminate />
        <v-alert v-if="message" type="info" class="mb-3">{{ message }}</v-alert>
        <v-alert v-if="conflict" type="warning" class="mb-3"
          >同じ情報が更新されました。入力を保持しています。最新値を読み直してください。</v-alert
        >
        <air-item-input
          v-if="draft"
          :item="draft"
          :schema="schema"
          :update-properties="editor.update"
          :disabled="busy || loading || uncertain"
          :edit-mode="operation === 'create' ? 'CREATE' : 'UPDATE'"
        >
          <!-- Dotted slot names use dynamic argument syntax for Vue language tooling. -->
          <template #[`input.displayName`]="{ attrs }">
            <air-text-field v-bind="attrs" />
          </template>
        </air-item-input>
    <template #prepend-actions>
        <v-btn
          v-if="operation !== 'create' || uncertain"
          :disabled="busy || loading"
          @click="editor.reload"
          >{{ uncertain ? "登録結果を確認" : "最新値を読み直す" }}</v-btn
        >
        <v-btn
          v-if="canRetryCreate"
          :disabled="busy || loading"
          @click="retryCreate"
          >同じ登録先で再送</v-btn
        >
    </template>
  </AppEditorDialog>
</template>
