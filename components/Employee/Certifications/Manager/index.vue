<script setup>
import { Certification } from "@/schemas";
import { useEmployeeCertifications } from "@/composables/application/employee/useEmployeeCertifications";
const props = defineProps({ employee: { type: Object, required: true } });
const editor = useEmployeeCertifications({ employeeId: () => props.employee.docId });
const { opened, busy, loading, conflict, uncertain, message, draft, action, rows, canWrite } = editor;
</script>
<template>
  <v-card title="保有資格">
    <v-card-actions><v-btn v-if="canWrite && employee.employmentStatus === 'ACTIVE'" prepend-icon="mdi-pencil" @click="editor.open">資格を編集</v-btn></v-card-actions>
    <EmployeeCertificationsTable :items="employee.securityCertifications" />
    <v-alert v-if="message && !opened" type="info">{{ message }}</v-alert>
  </v-card>
  <v-dialog :model-value="opened" persistent max-width="850">
    <v-card title="保有資格の編集">
      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate />
        <v-alert v-if="message" class="mb-3" type="info">{{ message }}</v-alert>
        <v-alert v-if="conflict" class="mb-3" type="warning">資格情報が更新されました。入力を保持しています。最新値を読み直してください。</v-alert>
        <v-list v-if="draft">
          <v-list-item v-for="row in rows" :key="row.originalPosition" :title="row.name" :subtitle="[row.serialNumber, row.issuedBy].filter(Boolean).join(' / ')">
            <template #append>
              <v-btn :aria-label="`${row.name} (${row.serialNumber || row.originalPosition + 1}) を編集`" :disabled="busy || loading || conflict || uncertain" @click="editor.select('update', row.originalPosition)">編集</v-btn>
              <v-btn :aria-label="`${row.name} (${row.serialNumber || row.originalPosition + 1}) を削除`" :disabled="busy || loading || conflict || uncertain" @click="editor.select('remove', row.originalPosition)">削除</v-btn>
            </template>
          </v-list-item>
        </v-list>
        <v-btn v-if="draft" class="mb-3" prepend-icon="mdi-plus" :disabled="busy || loading || conflict || uncertain" @click="editor.select('add')">資格を追加</v-btn>
        <v-alert v-if="action === 'remove' && draft" type="warning">「{{ draft.name }}」（{{ draft.serialNumber || '番号なし' }}）を削除します。下の「削除を確定」で保存します。</v-alert>
        <air-item-input v-else-if="draft" :item="draft" :schema="Certification.schema" :update-properties="editor.update" :disabled="busy || loading || conflict || uncertain" :edit-mode="action === 'add' ? 'CREATE' : 'UPDATE'" />
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="busy || loading" @click="editor.reload">{{ uncertain ? '保存結果を確認' : '最新値を読み直す' }}</v-btn><v-spacer />
        <v-btn :disabled="busy" @click="editor.close">キャンセル</v-btn>
        <v-btn color="primary" :loading="busy" :disabled="busy || loading || conflict || uncertain || !draft || !canWrite" @click="editor.save">{{ action === 'remove' ? '削除を確定' : '資格を保存' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
