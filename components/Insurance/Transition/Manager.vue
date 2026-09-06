<script setup>
import { Insurance } from "@/schemas";
import { useEmployeeInsurance } from "@/composables/application/employee/useEmployeeInsurance";
import InsuranceMenu from "./Menu/index.vue";
import InputEnroll from "./Input/Enroll.vue";
import InputEnrolled from "./Input/Enrolled.vue";
import InputCancel from "./Input/CancelEnrollment.vue";
import InputExempt from "./Input/Exempt.vue";
import InputLoss from "./Input/Loss.vue";
import InputRollback from "./Input/Rollback.vue";
const props = defineProps({ employee: { type: Object, required: true }, kind: { type: String, required: true }, title: { type: String, required: true } });
const editor = useEmployeeInsurance({ employeeId: () => props.employee.docId, kind: props.kind });
const { opened, busy, loading, conflict, uncertain, message, draft, action, canWrite } = editor;
const inputs = { enroll: InputEnroll, enrolled: InputEnrolled, cancelEnroll: InputCancel, exempt: InputExempt, loss: InputLoss, rollback: InputRollback };
const labels = { enroll: '加入', enrolled: '手続き完了', cancelEnroll: '手続き取り下げ', exempt: '適用除外', loss: '喪失', rollback: '履歴復元' };
const current = computed(() => props.employee[props.kind]);
</script>
<template>
  <v-card>
    <v-toolbar color="secondary" density="compact" :title="title">
      <template #append>
        <InsuranceMenu v-if="canWrite && employee.employmentStatus === 'ACTIVE'" :insurance="current"
          @click:enroll="editor.open('enroll')" @click:enrolled="editor.open('enrolled')" @click:cancel="editor.open('cancelEnroll')"
          @click:exempt="editor.open('exempt')" @click:loss="editor.open('loss')" @click:rollback="editor.open('rollback')">
          <template #activator="slotProps"><v-btn v-bind="slotProps.props" icon="mdi-dots-vertical" :aria-label="`${title}の操作`" /></template>
        </InsuranceMenu>
      </template>
    </v-toolbar>
    <v-card-text>
      <InsuranceStatusChip :status="current.status" :is-processing="current.isProcessing" />
      <div>番号: {{ current.number || '-' }}</div><div>資格取得日: {{ current.enrollmentDate || '-' }}</div><div>履歴: {{ current.history.length }} 件</div>
      <v-alert v-if="message && !opened" type="info" class="mt-2">{{ message }}</v-alert>
    </v-card-text>
  </v-card>
  <v-dialog :model-value="opened" persistent max-width="760">
    <v-card :title="`${title}・${labels[action] || '編集'}`">
      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate />
        <v-alert v-if="message" type="info" class="mb-3">{{ message }}</v-alert>
        <v-alert v-if="conflict" type="warning" class="mb-3">同じ保険情報が更新されました。入力を保持しています。最新値を読み直してください。</v-alert>
        <air-item-input v-if="draft" :item="draft" :schema="Insurance.schema" :update-properties="editor.update" :disabled="busy || loading || conflict || uncertain" edit-mode="UPDATE">
          <template #default="{ componentAttrs }"><component :is="inputs[action]" :item="draft" :component-attrs="componentAttrs" :update-properties="editor.update" /></template>
        </air-item-input>
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="busy || loading" @click="editor.reload">{{ uncertain ? '保存結果を確認' : '最新値を読み直す' }}</v-btn><v-spacer />
        <v-btn :disabled="busy" @click="editor.close">キャンセル</v-btn>
        <v-btn color="primary" :loading="busy" :disabled="busy || loading || conflict || uncertain || !draft || !canWrite" @click="editor.save">{{ labels[action] }}を保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
