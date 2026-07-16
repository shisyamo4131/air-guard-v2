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
      <!-- 日付の表示形式をカスタマイズ -->
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
  </div>
</template>

<style scoped></style>
