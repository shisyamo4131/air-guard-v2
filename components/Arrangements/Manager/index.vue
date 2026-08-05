<script setup>
/*****************************************************************************
 * @file components/arrangements/Manager/index.vue
 * @description A component for managing site operation schedules, including viewing, creating, updating, and duplicating schedules.
 * It also provides functionalities for managing workers, site orders, and notifications.
 *
 * @property {Date} startDate - スケジュール表示の開始日
 * @property {Date} endDate - スケジュール表示の終了日
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";
import Table from "./Table.vue";
import WeekdayActions from "./WeekdayActions.vue";
import CommandTextDialog from "./CommandTextDialog.vue";
import FloatingWindow from "@/components/molecules/FloatingWindow.vue";
import SpeedDial from "./SpeedDial.vue";
import DailyHeaderSummary from "./DailyHeaderSummary.vue";
import DailyStatusSummary from "./DailyStatusSummary.vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementsManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  startDate: {
    type: Object,
    required: true,
    validator: (v) => v instanceof Date,
  },
  endDate: {
    type: Object,
    required: true,
    validator: (v) => v instanceof Date,
  },
});
const props = useDefaults(_props, "ArrangementsManager");

/** 以下は後日、useIndex 側に集約すべき */
const securityReportDialog = ref(false);
const selectedScheduleId = ref(null);
watch(securityReportDialog, (newVal) => {
  if (newVal) return;
  selectedScheduleId.value = null;
});

/*****************************************************************************
 * DEFINE TEMPLATE REFS
 *****************************************************************************/
const scheduleManager = useTemplateRef("scheduleManager");
const notificationManager = useTemplateRef("notificationManager");
const workerManager = useTemplateRef("workerManager");

/*****************************************************************************
 * SETUP MANAGER COMPOSABLE
 *****************************************************************************/
const managerComposable = useIndex(props, {
  refSiteOperationScheduleManager: scheduleManager,
  refArrangementNotificationManager: notificationManager,
  refWorkerManager: workerManager,
});

const {
  uiTable,
  uiWorkerSelector,
  uiSiteShiftTypeJumpList,
  uiSiteShiftTypeReorder,
  uiSiteOperationScheduleDuplicator,
  uiCommandTextDialog,
  uiSpeedDial,
} = managerComposable;
</script>

<template>
  <div class="fill-height">
    <!-- フローティング作業員選択ウィンドウ -->
    <FloatingWindow v-bind="uiWorkerSelector.dialog.attrs" title="作業員選択">
      <ArrangementsWorkerSelector v-bind="uiWorkerSelector.component.attrs" />
    </FloatingWindow>

    <!-- 現場勤務区分ジャンプメニュー -->
    <v-menu v-bind="uiSiteShiftTypeJumpList.menu.attrs">
      <SiteShiftTypeOrderList
        v-bind="uiSiteShiftTypeJumpList.component.attrs"
      />
    </v-menu>

    <!-- スケジュール管理テーブル -->
    <Table class="fill-height" v-bind="uiTable.component.attrs">
      <!-- 日付と日別人数集計を縦に表示 -->
      <template #day="{ column }">
        <div class="d-flex flex-column align-center">
          <span>{{ column.format("MM/DD(ddd)") }}</span>
          <DailyHeaderSummary
            v-bind="uiTable.component.dailySummary.getAttrs({ column })"
          />
        </div>
      </template>

      <!-- 既存の祝日アイコンを保持 -->
      <template #append-day="{ column, holidayIcon }">
        <v-icon v-if="column.isHoliday" v-bind="holidayIcon" />
      </template>

      <!-- 曜日セルのカスタマイズ -->
      <template #weekday="weekdayProps">
        <WeekdayActions
          v-bind="uiTable.component.weekdayActions.getAttrs(weekdayProps)"
        />
      </template>

      <!-- セルのカスタマイズ -->
      <template #cell="cellProps">
        <DraggableOperationSchedules
          class="fill-height"
          v-bind="
            uiTable.component.draggableOperationSchedules.getAttrs(cellProps)
          "
        >
          <template #default="{ schedule, disabled }">
            <!--
              現場稼働予定カードコンポーネント
              - `update:schedule` イベントは `DraggableWorkers` によって作業員の追加や削除、順序変更が行われた場合に発火。
              - 作業員配置情報以外の情報更新は `update:edit` イベントを受けて `SiteOperationScheduleManager` で行われる。
            -->
            <SiteOperationScheduleCard
              class="mb-2"
              style="border: 1px dashed grey"
              v-bind="
                uiTable.component.siteOperationScheduleCard.getAttrs({
                  schedule,
                  disabled,
                })
              "
              @click:security-report="
                () => {
                  selectedScheduleId = schedule.docId;
                  securityReportDialog = true;
                }
              "
            >
              <template #default="cardProps">
                <DraggableWorkers
                  class="fill-height"
                  v-bind="
                    uiTable.component.draggableWorkers.getAttrs(cardProps)
                  "
                >
                  <template #default="propsForTag">
                    <SiteOperationScheduleWorkerTag
                      v-bind="
                        uiTable.component.workerTag.getAttrs({
                          slotProps: propsForTag,
                          schedule,
                        })
                      "
                    />
                  </template>
                </DraggableWorkers>
              </template>
            </SiteOperationScheduleCard>
          </template>
        </DraggableOperationSchedules>
      </template>

      <template #footer="{ column }">
        <DailyStatusSummary
          v-bind="uiTable.component.dailySummary.getAttrs({ column })"
        />
      </template>
    </Table>

    <!-- 現場オーダー並び替え用コンポーネント -->
    <AtomsDialogsFullscreen v-bind="uiSiteShiftTypeReorder.dialog.attrs">
      <template #default>
        <SiteShiftTypeOrderReorderForm
          v-bind="uiSiteShiftTypeReorder.component.attrs"
        />
      </template>
    </AtomsDialogsFullscreen>

    <!-- スケジュール編集コンポーネント -->
    <SiteOperationScheduleManager ref="scheduleManager" />

    <!-- スケジュール複製コンポーネント -->
    <SiteOperationScheduleDuplicator
      v-bind="uiSiteOperationScheduleDuplicator.attrs"
    />

    <!-- 通知ステータス更新コンポーネント -->
    <ArrangementNotificationManager ref="notificationManager" includes-status />

    <!-- 作業員配置詳細情報編集コンポーネント -->
    <SiteOperationScheduleWorkerDetailManager
      ref="workerManager"
      hide-delete-btn
    />

    <!-- 配置テキスト表示ダイアログ -->
    <CommandTextDialog v-bind="uiCommandTextDialog.attrs" />

    <!-- スピードダイアル -->
    <SpeedDial v-bind="uiSpeedDial.attrs" />

    <!-- 警備日報表示ダイアログ -->
    <v-dialog v-model="securityReportDialog" max-width="480">
      <v-card :border="false">
        <v-toolbar color="secondary" flat density="compact">
          <v-toolbar-title>警備日報</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" @click="securityReportDialog = false" />
        </v-toolbar>
        <v-card-text class="pb-0">
          <SecurityReportsManager :schedule-id="selectedScheduleId" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped></style>
