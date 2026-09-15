<script setup>
import { useDefaults } from "vuetify";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useConstants } from "@/composables/useConstants";
import { useBaseManager } from "@/composables/useBaseManager";
import { equal } from "@/composables/domain/shared/valueContract";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementNotificationsManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every((item) => item instanceof ArrangementNotification),
  },
});
const props = useDefaults(_props, "ArrangementNotificationsManager");
const emit = defineEmits(["submit:complete"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { ARRANGEMENT_NOTIFICATION_STATUS: DEFINITION } = useConstants();
const { attrs } = useBaseManager("ArrangementNotificationsManager");
const manager = useTemplateRef("manager");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const schedule = shallowRef(null);
const editingDocId = ref(null);
const listenerSnapshot = shallowRef(null);
const baselineStatus = ref(null);
const next = computed(
  () => DEFINITION.value?.[baselineStatus.value]?.next || null,
);
const internalDocs = computed(() =>
  props.modelValue.toSorted((a, b) =>
    a.date > b.date
      ? 1
      : a.date < b.date
        ? -1
        : a.shiftType > b.shiftType
          ? 1
          : a.shiftType < b.shiftType
            ? -1
            : 0,
  ),
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function toSnapshot(item) {
  return item?.toObject ? item.toObject() : item;
}

function latestForEditing() {
  if (!editingDocId.value) return null;
  return (
    props.modelValue.find((item) => item.docId === editingDocId.value) || null
  );
}

function syncEditingItemFromListener() {
  const latest = latestForEditing();
  if (!latest) return;
  const snapshot = toSnapshot(latest);
  if (equal(snapshot, listenerSnapshot.value)) return;
  if (manager.value?.updateProperties) {
    manager.value.updateProperties(snapshot);
    baselineStatus.value = latest.status;
  }
  listenerSnapshot.value = snapshot;
}

function clearEditingState() {
  editingDocId.value = null;
  listenerSnapshot.value = null;
  baselineStatus.value = null;
  schedule.value = null;
}

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.modelValue,
  () => syncEditingItemFromListener(),
  { deep: true },
);

async function beforeEdit(editMode, item) {
  if (editMode !== "UPDATE") {
    throw new Error("この画面では配置通知の作成・削除を実行できません。");
  }
  editingDocId.value = item.docId;
  listenerSnapshot.value = null;
  baselineStatus.value = item.status;
  try {
    schedule.value = await new SiteOperationSchedule().fetchDoc({
      docId: item.siteOperationScheduleId,
    });
    if (!schedule.value) throw new Error("現場稼働予定を取得できません。");
    const latest = latestForEditing();
    if (latest) {
      manager.value?.updateProperties(toSnapshot(latest));
      baselineStatus.value = latest.status;
      listenerSnapshot.value = toSnapshot(latest);
    }
  } catch (error) {
    clearEditingState();
    throw error;
  }
  return true;
}

async function handleUpdate(item) {
  const transition = DEFINITION.value?.[baselineStatus.value]?.next?.transition;
  if (!transition || typeof item[transition] !== "function") {
    throw new Error("配置通知の状態遷移を確認できません。");
  }
  return await item[transition]();
}

function handleSubmitComplete(event) {
  emit("submit:complete", event.item);
}

function handleChildSubmitComplete(event) {
  emit("submit:complete", event.item);
  manager.value?.quitEditing();
}

function closeEditor() {
  manager.value?.quitEditing();
}
</script>

<template>
  <air-array-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="internalDocs"
    :schema="ArrangementNotification"
    item-key="docId"
    hide-create-btn
    hide-delete-btn
    disable-delete
    :before-edit="beforeEdit"
    :handle-create="
      () => {
        throw new Error('この画面では配置通知を作成できません。');
      }
    "
    :handle-update="handleUpdate"
    :handle-delete="
      () => {
        throw new Error('この画面では配置通知を削除できません。');
      }
    "
    @submit:complete="handleSubmitComplete"
    @quit="clearEditingState"
  >
    <template #table="tableProps">
      <v-card>
        <v-toolbar
          color="secondary"
          density="compact"
          title="あなたの直近配置情報"
        />
        <v-alert v-if="tableProps.isLoading" type="info" class="ma-3"
          >読み込み中です。</v-alert
        >
        <air-list v-if="internalDocs.length" class="py-0">
          <template v-for="(item, index) of internalDocs" :key="item.docId">
            <ArrangementNotificationListItem
              v-bind="item"
              class="mt-2"
              :notification="item"
              show-message
              show-status
              :disabled="tableProps.disabled || tableProps.isLoading"
              @click="tableProps.toUpdate(item)"
            />
            <v-divider v-if="index < internalDocs.length - 1" />
          </template>
        </air-list>
        <v-empty-state v-else icon="mdi-alert-circle-outline">
          <template #title>直近の配置情報はありません</template>
          <template #text
            >現在、あなたの配置情報はありません。<br />配置情報が追加されると、ここに表示されます。</template
          >
        </v-empty-state>
      </v-card>
    </template>

    <template #input-default="{ item }">
      <air-list no-padding>
        <ArrangementNotificationListItem :notification="item" />
      </air-list>
      <v-list-subheader>メンバー</v-list-subheader><v-divider class="mb-2" />
      <div class="mb-4 d-flex flex-wrap ga-2">
        <WorkerChip
          v-for="(worker, index) of schedule?.workers || []"
          :key="index"
          :worker="worker"
          density="compact"
        />
      </div>
      <v-list-subheader>警備日報</v-list-subheader><v-divider class="mb-2" />
      <SecurityReportsManager
        v-if="['ARRIVED', 'LEAVED'].includes(item?.status)"
        :schedule-id="schedule?.docId"
      />
    </template>

    <template #editor-actions="{ item, submit, loading, disabled }">
      <ArrangementNotificationManagerToLeaved
        v-if="next?.status === 'LEAVED'"
        :model-value="item"
        @submit:complete="handleChildSubmitComplete"
      >
        <template #activator="activatorProps">
          <ArrangementNotificationTransitionBtn
            :notification="item"
            type="next"
            block
            variant="elevated"
            :loading="activatorProps.isLoading"
            :disabled="activatorProps.disableUpdate || activatorProps.isLoading"
            @click="activatorProps.toUpdate(item)"
          />
        </template>
      </ArrangementNotificationManagerToLeaved>
      <ArrangementNotificationTransitionBtn
        v-else-if="next"
        :notification="item"
        type="next"
        block
        variant="elevated"
        :loading="loading"
        :disabled="disabled || loading"
        @click="submit"
      />
      <v-btn
        v-else
        block
        variant="text"
        :disabled="loading"
        @click="closeEditor"
        >閉じる</v-btn
      >
    </template>

    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot
        v-if="!['table', 'input-default', 'editor-actions'].includes(name)"
        :name="name"
        v-bind="scope || {}"
      />
    </template>
  </air-array-manager>
</template>
