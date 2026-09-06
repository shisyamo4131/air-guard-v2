<script setup>
import { ArrangementNotification } from "@/schemas";
const props = defineProps({ personal: { type: Object, required: true } });
const editor = props.personal.editor, opened = ref(false);
const fields = ["dateAt", "actualStartTime", "actualIsStartNextDay", "actualEndTime", "actualBreakMinutes"];
const schema = fields.map((key) => ({ key, ...ArrangementNotification.classProps[key] }));
watch(editor.baseline, () => { opened.value = false; });
async function save() { if (await props.personal.saveNext()) opened.value = false; }
</script>
<template>
  <v-btn color="primary" :disabled="personal.disabled.value" @click="opened = true">{{ personal.next.value?.text }}</v-btn>
  <v-dialog :model-value="opened && editor.opened.value" persistent max-width="600">
    <v-card title="下番報告">
      <v-card-text>
        <v-alert v-if="editor.message.value" type="info" class="mb-3">{{ editor.message.value }}</v-alert>
        <air-item-input v-if="editor.draft.value" :item="editor.draft.value" :schema="schema" :update-properties="editor.update" :disabled="personal.disabled.value" edit-mode="UPDATE">
          <template #default="{ componentAttrs }">
            <v-row>
              <v-col cols="12"><air-date-input v-bind="componentAttrs.dateAt" disabled /></v-col>
              <v-col cols="12"><air-time-picker-input v-bind="componentAttrs.actualStartTime" /></v-col>
              <v-col cols="12"><IsStartNextDayCheckbox v-bind="componentAttrs.actualIsStartNextDay" /></v-col>
              <v-col cols="12"><air-time-picker-input v-bind="componentAttrs.actualEndTime" /></v-col>
              <v-col cols="12"><AtomsHourInput v-bind="componentAttrs.actualBreakMinutes" label="休憩時間" :step="0.5" /></v-col>
            </v-row>
          </template>
        </air-item-input>
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="editor.busy.value" @click="personal.reload">最新値を読み直す</v-btn>
        <v-spacer /><v-btn :disabled="editor.busy.value" @click="personal.close">キャンセル</v-btn>
        <v-btn color="primary" :disabled="personal.disabled.value" :loading="editor.busy.value" @click="save">下番報告</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
