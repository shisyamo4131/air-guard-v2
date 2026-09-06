<script setup>
import { useEmployeeEditor } from "@/composables/application/employee/useEmployeeEditor";
import { operationSchema } from "@/functions/shared/employeeContract.js";
const props = defineProps({ employee: { type: Object, default: null }, operation: { type: String, required: true }, title: { type: String, required: true } });
const emit = defineEmits(["saved"]);
const editor = useEmployeeEditor({ operation: props.operation, employeeId: () => props.employee?.docId });
const { opened, busy, loading, conflict, uncertain, canRetryCreate, message, draft, canWrite } = editor;
const schema = operationSchema(props.operation);
async function save() { const result = await editor.save(); if (result) emit("saved", result); }
async function retryCreate() { const result = await editor.retryCreate(); if (result) emit("saved", result); }
</script>
<template>
  <slot :open="editor.open" :can-edit="canWrite && (!employee || employee.employmentStatus === 'ACTIVE')" />
  <v-alert v-if="message && !opened" type="info" class="my-2">{{ message }}</v-alert>
  <v-dialog :model-value="opened" persistent max-width="760">
    <v-card :title="title">
      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate />
        <v-alert v-if="message" type="info" class="mb-3">{{ message }}</v-alert>
        <v-alert v-if="conflict" type="warning" class="mb-3">同じ情報が更新されました。入力を保持しています。最新値を読み直してください。</v-alert>
        <air-item-input v-if="draft" :item="draft" :schema="schema" :update-properties="editor.update" :disabled="busy || loading || uncertain" :edit-mode="operation === 'create' ? 'CREATE' : 'UPDATE'">
          <!-- Static Vuetify tag is auto-imported and does not echo prop changes. -->
          <template #input.displayName="{ attrs }">
            <v-text-field v-bind="attrs" />
          </template>
        </air-item-input>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="operation !== 'create' || uncertain" :disabled="busy || loading" @click="editor.reload">{{ uncertain ? '登録結果を確認' : '最新値を読み直す' }}</v-btn>
        <v-spacer />
        <v-btn v-if="canRetryCreate" :disabled="busy || loading" @click="retryCreate">同じ登録先で再送</v-btn>
        <v-btn :disabled="busy" @click="editor.close">キャンセル</v-btn>
        <v-btn color="primary" :loading="busy" :disabled="busy || loading || conflict || uncertain || !draft || !canWrite" @click="save">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
