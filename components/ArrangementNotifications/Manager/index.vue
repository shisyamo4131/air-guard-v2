<script setup>
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";
import { usePersonalNotification } from "@/composables/application/operation/usePersonalNotification";
const _props = defineProps({ modelValue: { type: Array, default: () => [] } });
const props = useDefaults(_props, "ArrangementNotificationsManager");
const { ARRANGEMENT_NOTIFICATION_STATUS: DEFINITION } = useConstants();
const personal = usePersonalNotification(DEFINITION), editor = personal.editor;
const internalDocs = computed(() => props.modelValue.toSorted((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : a.shiftType > b.shiftType ? 1 : a.shiftType < b.shiftType ? -1 : 0));
</script>
<template>
  <v-card>
    <v-toolbar color="secondary" density="compact" title="あなたの直近配置情報" />
    <v-alert v-if="editor.message.value && !editor.opened.value" type="info">{{ editor.message.value }}</v-alert>
    <air-list v-if="internalDocs.length" class="py-0">
      <template v-for="(item, index) of internalDocs" :key="item.docId">
        <ArrangementNotificationListItem v-bind="item" class="mt-2" :notification="item" show-message show-status :disabled="!editor.canWrite.value || editor.busy.value" @click="personal.open(item)" />
        <v-divider v-if="index < internalDocs.length - 1" />
      </template>
    </air-list>
    <v-empty-state v-else icon="mdi-alert-circle-outline">
      <template #title>直近の配置情報はありません</template>
      <template #text>現在、あなたの配置情報はありません。<br />配置情報が追加されると、ここに表示されます。</template>
    </v-empty-state>
  </v-card>
  <v-dialog :model-value="editor.opened.value" persistent scrollable max-width="760">
    <v-card title="配置通知">
      <v-card-text>
        <v-progress-linear v-if="editor.loading.value || personal.preparing.value" indeterminate />
        <v-alert v-if="editor.message.value" type="info" class="mb-3">{{ editor.message.value }}</v-alert>
        <template v-if="editor.draft.value && personal.schedule.value">
          <air-list no-padding><ArrangementNotificationListItem :notification="editor.draft.value" /></air-list>
          <v-list-subheader>メンバー</v-list-subheader><v-divider class="mb-2" />
          <div class="mb-4 d-flex flex-wrap ga-2"><WorkerChip v-for="(worker, index) of personal.schedule.value.workers" :key="index" :worker="worker" density="compact" /></div>
          <v-list-subheader>警備日報</v-list-subheader><v-divider class="mb-2" />
          <SecurityReportsManager v-if="['ARRIVED', 'LEAVED'].includes(editor.baseline.value.status)" :schedule-id="personal.schedule.value.docId" />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="editor.busy.value || personal.preparing.value" @click="personal.reload">最新値を読み直す</v-btn>
        <v-spacer /><v-btn :disabled="editor.busy.value" @click="personal.close">キャンセル</v-btn>
        <ArrangementNotificationManagerToLeaved v-if="personal.next.value?.status === 'LEAVED'" :personal="personal" />
        <v-btn v-else-if="personal.next.value" color="primary" :disabled="personal.disabled.value" :loading="editor.busy.value" @click="personal.saveNext">{{ personal.next.value.text }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
