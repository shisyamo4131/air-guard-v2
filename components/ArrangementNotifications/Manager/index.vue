<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotifications/Manager/index.vue
 * @description A component for managing `ArrangementNotifications`.
 * @extends AirArrayManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useConstants } from "@/composables/useConstants";
import { useSecurityReports } from "@/composables/storage/useSecurityReports";

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
const securityReports = useSecurityReports(
  toRef(siteOperationSchedule, "docId"),
);

// ルートコンポーネントである AirArrayManager への参照。
// 下番への状態遷移時、AirArrayManager の quitEditing メソッドを呼び出すために利用。
const managerRef = useTemplateRef("manager");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * 配置通知ドキュメントを、日付降順、勤務区分昇順でソートしたものを返す。
 */
const internalDocs = computed(() => {
  return props.modelValue.toSorted((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
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
    await securityReports.fetch();
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
      </v-card>
    </template>

    <!-- SLOT: INPUT DEFAULT -->
    <template #input-default="{ item }">
      <!-- NOTIFICATION DETAIL -->
      <air-list fluid>
        <ArrangementNotificationListItem :notification="item" />
      </air-list>

      <!-- MEMBERS -->
      <v-card>
        <v-card-item>
          <v-card-title class="text-body-2">メンバー</v-card-title>
        </v-card-item>
        <v-card-text>
          <div class="d-flex flex-wrap ga-2">
            <WorkerChip
              v-for="(worker, index) of siteOperationSchedule.workers"
              :key="index"
              :worker="worker"
              density="compact"
            />
          </div>
        </v-card-text>
      </v-card>

      <!-- SECURITY REPORT FILE UPLOADER -->
      <v-col cols="12">
        <v-file-input v-bind="securityReports.attrs.value" class="mb-1" />
      </v-col>

      <!-- 取得した画像一覧 -->
      <v-row v-if="!securityReports.isEmpty.value">
        <v-col
          v-for="report in securityReports.reports.value"
          :key="report.ref.fullPath"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card>
            <!-- サムネイルがあればサムネイル、なければ本体 URL を表示 -->
            <v-img
              :src="report.thumbUrl ?? report.url"
              aspect-ratio="1.5"
              cover
            >
              <template #placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey" />
                </v-row>
              </template>
            </v-img>
            <v-card-actions>
              <v-btn
                color="error"
                size="small"
                variant="text"
                :loading="securityReports.isDeleting(report)"
                @click="securityReports.del(report)"
              >
                削除
              </v-btn>
              <v-spacer />
              <v-btn
                :href="report.url"
                target="_blank"
                size="small"
                variant="text"
              >
                フルサイズを開く
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
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
