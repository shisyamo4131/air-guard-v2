<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotifications/Manager/index.vue
 * @description A component for managing `ArrangementNotifications`.
 * @extends AirArrayManager
 * - 従業員が自身への配置通知を確認し、状態遷移させるためのコンポーネント。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  modelValue: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "ArrangementNotificationsManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs, isLoading, logger, isDev } = useBaseManager(
  "ArrangementNotificationsManager",
);
const loadings = useLoadingsStore();
const { ARRANGEMENT_NOTIFICATION_STATUS: DEFINITION } = useConstants();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const siteOperationSchedule = reactive(new SiteOperationSchedule());

// ルートコンポーネントである AirArrayManager への参照。
// 下番への状態遷移時、AirArrayManager の quitEditing メソッドを呼び出すために利用。
const managerRef = useTemplateRef("manager");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * 配置通知ドキュメントを、日付昇順、勤務区分昇順でソートしたものを返す。
 */
const internalDocs = computed(() => {
  return props.modelValue.toSorted((a, b) => {
    if (a.date > b.date) return 1;
    if (a.date < b.date) return -1;
    if (a.shiftType > b.shiftType) return 1;
    if (a.shiftType < b.shiftType) return -1;
    return 0;
  });
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * AirArrayManager の before-edit イベントハンドラー。
 * - 現場稼働予定ドキュメントを取得する。
 * - 警備日報写真の一覧を取得する。
 * @param editMode
 * @param notification
 */
async function beforeEditHandler(editMode, notification) {
  const key = loadings.add("現場稼働予定を取得しています...");
  try {
    isLoading.value = true;
    await siteOperationSchedule.fetch({
      docId: notification.siteOperationScheduleId,
    });
    return true;
  } catch (error) {
    logger.error({ error });
    return false;
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

/**
 * AirItemManager の handle-update イベントハンドラー。
 * - 配置通知ドキュメントの状態を遷移させる。
 * - 下番への状態遷移の場合は、AirItemManager に任せる。
 * @param item
 */
async function onUpdateHandler(item) {
  let key = "";
  try {
    // Get the function name of the next transition from `ARRANGEMENT_NOTIFICATION_STATUS` definition
    const nextDefinition = DEFINITION.value?.[item.status]?.next || null;
    if (!nextDefinition && isDev) {
      throw new Error(
        `No next status definition found for status: ${item.status}`,
      );
    }

    // Get the transition function from the `item` using the function name obtained from the definition.
    const transitionFn = item[nextDefinition?.transition] || null;
    if (typeof transitionFn !== "function" && isDev) {
      throw new Error(
        `Transition function ${nextDefinition?.transition} is not defined on the item.`,
      );
    }

    // Call the transition function to update the arrangement notification's status.
    key = loadings.add("配置通知を更新しています...");
    isLoading.value = true;
    await transitionFn.call(item.clone());
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    ref="manager"
    :model-value="internalDocs"
    :before-edit="beforeEditHandler"
    :schema="ArrangementNotification"
    :handle-update="onUpdateHandler"
    hide-delete-btn
  >
    <template #table="{ items, toUpdate }">
      <v-card>
        <v-toolbar
          color="secondary"
          density="compact"
          title="あなたの直近配置情報"
        />
        <air-list v-if="items.length !== 0" class="py-0">
          <template v-for="(item, index) of items" :key="index">
            <ArrangementNotificationListItem
              v-bind="item"
              class="mt-2"
              :notification="item"
              show-message
              show-status
              @click="() => toUpdate(item)"
            />
            <v-divider v-if="index < items.length - 1" />
          </template>
        </air-list>
        <v-empty-state v-else icon="mdi-alert-circle-outline">
          <template #title>直近の配置情報はありません</template>
          <template #text>
            現在、あなたの配置情報はありません。<br />配置情報が追加されると、ここに表示されます。
          </template>
        </v-empty-state>
      </v-card>
    </template>

    <!-- SLOT: INPUT DEFAULT -->
    <template #input-default="{ item }">
      <!-- NOTIFICATION DETAIL -->
      <air-list no-padding>
        <ArrangementNotificationListItem :notification="item" />
      </air-list>

      <!-- MEMBERS -->
      <v-list-subheader>メンバー</v-list-subheader>
      <v-divider class="mb-2" />
      <div class="mb-4 d-flex flex-wrap ga-2">
        <WorkerChip
          v-for="(worker, index) of siteOperationSchedule.workers"
          :key="index"
          :worker="worker"
          density="compact"
        />
      </div>

      <!-- SECURITY REPORT FILE UPLOADER -->
      <v-list-subheader>警備日報</v-list-subheader>
      <v-divider class="mb-2" />
      <SecurityReportsManager
        v-if="
          item.status === DEFINITION.ARRIVED.value ||
          item.status === DEFINITION.LEAVED.value
        "
        :schedule-id="siteOperationSchedule.docId"
      />
    </template>
    <template #editor-actions="{ item, submit }">
      <!-- 状態遷移ボタン -->
      <!-- 下番への状態遷移以外を担当 -->
      <ArrangementNotificationTransitionBtn
        v-if="item.status !== DEFINITION.ARRIVED.value"
        :notification="item"
        type="next"
        block
        variant="elevated"
        @click="submit"
      />

      <!-- 下番への状態遷移を担当する AirItemManager -->
      <ArrangementNotificationManagerToLeaved
        v-else
        label="下番報告"
        :handle-update="(item) => item.toLeaved()"
        :model-value="item"
        class="flex-grow-1"
        :site-operation-schedule-id="item.siteOperationScheduleId"
        @submit:complete="managerRef.quitEditing"
      >
        <template #activator="{ props: activatorProps, toUpdate }">
          <ArrangementNotificationTransitionBtn
            v-bind="activatorProps"
            :notification="item"
            type="next"
            block
            variant="elevated"
            @click="() => toUpdate()"
          />
        </template>
      </ArrangementNotificationManagerToLeaved>
    </template>
  </air-array-manager>
</template>
