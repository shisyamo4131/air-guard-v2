<script setup>
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useMessagesStore } from "@/stores/useMessagesStore";
import List from "./List.vue";
import Detail from "./Detail.vue";

const props = defineProps({
  siteOperationSchedules: {
    type: Array,
    default: () => [],
    validator: (items) => items.every((item) => item instanceof SiteOperationSchedule),
  },
});
const selectedSchedule = ref(null);
const messages = useMessagesStore();
const notificationInstance = reactive(new ArrangementNotification());
const notifications = ref([]);
const preparing = ref(false);
const confirming = ref(false);
const ready = ref(false);
const error = ref("");
let preparationGeneration = 0;

const notificationsMap = computed(() =>
  Object.fromEntries(notifications.value.map((item) => [item.docId, item])),
);
const sortedSchedules = computed(() =>
  [...props.siteOperationSchedules].sort(
    (a, b) => a.date.localeCompare(b.date) || a.shiftType.localeCompare(b.shiftType),
  ),
);

function clearNotifications() {
  notificationInstance.unsubscribe();
  notificationInstance.docs = [];
  notifications.value = [];
}

async function prepare(schedule) {
  if (confirming.value) return;
  const generation = ++preparationGeneration;
  clearNotifications();
  ready.value = false;
  error.value = "";
  if (!schedule) {
    preparing.value = false;
    return;
  }
  preparing.value = true;
  try {
    const constraints = [["where", "siteOperationScheduleId", "==", schedule.docId]];
    const fetched = await notificationInstance.fetchDocs({ constraints });
    if (generation !== preparationGeneration || selectedSchedule.value !== schedule) return;
    notifications.value = fetched;
    notificationInstance.subscribeDocs({
      constraints,
    }, () => {
      if (generation === preparationGeneration && selectedSchedule.value === schedule) {
        notifications.value = [...notificationInstance.docs];
      }
    });
    ready.value = true;
  } catch {
    if (generation === preparationGeneration && selectedSchedule.value === schedule) {
      error.value = "配置通知を取得できません。予定を再選択するか、画面を再表示してください。";
    }
  } finally {
    if (generation === preparationGeneration) preparing.value = false;
  }
}

watch(selectedSchedule, (schedule) => prepare(schedule), { flush: "sync", immediate: true });
onScopeDispose(() => {
  preparationGeneration += 1;
  notificationInstance.unsubscribe();
});

async function beforeEdit(editMode, item) {
  if (confirming.value) return false;
  if (editMode !== "UPDATE") {
    throw new Error("この画面では上下番確定以外の操作を実行できません。");
  }
  if (!ready.value) {
    error.value = "配置通知を確認できません。予定を再選択するか、画面を再表示してください。";
    return false;
  }
  if (item?.docId !== selectedSchedule.value?.docId) {
    error.value = "選択中の予定が変わりました。再選択してから再実行してください。";
    return false;
  }
  const targetDocId = item.docId;
  const targetSchedule = item;
  const targetNotificationsMap = Object.fromEntries(
    Object.entries(notificationsMap.value).map(([key, notification]) => [key, notification]),
  );
  confirming.value = true;
  error.value = "";
  try {
    await targetSchedule.syncToOperationResult(targetNotificationsMap);
    messages.add("上下番を確定しました。");
    if (selectedSchedule.value?.docId === targetDocId) {
      selectedSchedule.value = null;
    }
    return false;
  } catch (cause) {
    error.value = "上下番を確定できません。選択内容を確認して再試行してください。";
    throw cause;
  } finally {
    confirming.value = false;
    if (!selectedSchedule.value) {
      clearNotifications();
      ready.value = false;
    }
  }
}

provide("selectedSchedule", selectedSchedule);
provide("notifications", notifications);
provide("notificationsMap", notificationsMap);
</script>

<template>
  <div class="operation-result-generator d-flex flex-column fill-height overflow-hidden" style="min-height: 0">
    <SiteOperationSchedulesManager
      class="flex-grow-1 overflow-hidden"
      style="min-height: 0"
      :docs="sortedSchedules"
      :before-edit="beforeEdit"
    >
    <template #table="{ items, toUpdate, isLoading }">
      <div class="d-flex flex-column flex-grow-1 fill-height overflow-hidden ga-2" style="min-height: 0">
        <v-alert v-if="error" type="warning">{{ error }}</v-alert>
        <div class="d-flex flex-grow-1 overflow-hidden ga-2" style="min-height: 0">
          <List
            class="fill-height"
            :items="items"
            :loading="isLoading || confirming"
          />
          <Detail
            class="fill-height"
            :loading="isLoading || preparing || confirming || !ready"
            @click:submit="toUpdate(selectedSchedule)"
          />
        </div>
      </div>
    </template>
    </SiteOperationSchedulesManager>
    <v-dialog v-model="confirming" persistent max-width="360">
      <v-card>
        <v-card-text class="d-flex align-center ga-3">
          <v-progress-circular indeterminate size="22" />
          <span>上下番を確定しています。</span>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>
