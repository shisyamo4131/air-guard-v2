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

// MANAGER COMPOSABLES
import { useIndex } from "./useIndex";

// Components
import Table from "./Table.vue";
import WeekdayActions from "./WeekdayActions.vue";
import CommandTextDialog from "./CommandTextDialog.vue";
import FloatingWindow from "@/components/molecules/FloatingWindow.vue";
import SpeedDial from "./SpeedDial.vue";

// OTHER（後で整理）
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";

/**
 * Duplicator Composable
 * @description 現場運用スケジュール複製用コンポーザブル
 */
const duplicatorComposable = useSiteOperationScheduleDuplicator();

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
const siteOperationScheduleManager = useTemplateRef(
  "siteOperationScheduleManager",
);
const arrangementNotificationManager = useTemplateRef(
  "arrangementNotificationManager",
);
const workerManager = useTemplateRef("workerManager");

/*****************************************************************************
 * SETUP MANAGER COMPOSABLE
 *****************************************************************************/
const managerComposable = useIndex(props, {
  refSiteOperationScheduleManager: siteOperationScheduleManager,
  refArrangementNotificationManager: arrangementNotificationManager,
  refWorkerManager: workerManager,
});

const {
  uiTable,
  uiWorkerSelector,
  uiSiteShiftTypeJumpList,
  uiSiteShiftTypeReorder,
  uiCommandTextDialog,
  uiSpeedDial,
} = managerComposable;
const { getNotification, notify, updateSchedule, updateSchedules } =
  managerComposable;
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
      <template #weekday="{ column, isSelected }">
        <WeekdayActions
          v-bind="uiTable.component.weekdayActions.attrs"
          :column="column"
          :is-selected="isSelected"
        />
      </template>

      <!-- セルのカスタマイズ -->
      <template
        #cell="{
          date,
          siteId,
          shiftType,
          schedules,
          disabled,
          notificationIndexes,
        }"
      >
        <DraggableOperationSchedules
          class="fill-height"
          :schedules="schedules"
          :disabled="disabled"
          @update:schedules="
            updateSchedules($event, { date, siteId, shiftType })
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
              :is-draggable="!disabled"
              :schedule="schedule"
              :show-actions="!disabled"
              @click:duplicate="duplicatorComposable.set(schedule)"
              @click:notify="notify(schedule)"
              @click:edit="siteOperationScheduleManager.toUpdate(schedule)"
              @update:schedule="updateSchedule($event)"
            >
              <template #default="cardProps">
                <DraggableWorkers
                  class="fill-height"
                  v-bind="cardProps.model"
                  :disabled="disabled"
                >
                  <!-- draggableWorkerProps: { worker, highlight, isDraggable, removable, onClick:remove } -->
                  <template #default="draggableWorkersProps">
                    <SiteOperationScheduleWorkerTag
                      v-bind="draggableWorkersProps"
                      :schedule="schedule"
                      :hide-edit="disabled"
                      :hide-notification="disabled"
                      :notification="
                        notificationIndexes.byDocId.get(
                          draggableWorkersProps.worker.notificationKey,
                        )
                      "
                      @click:edit="
                        workerManager.toUpdate({
                          schedule,
                          worker: draggableWorkersProps.worker,
                        })
                      "
                      @click:notification="
                        arrangementNotificationManager.toUpdate($event)
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
    <SiteOperationScheduleManager ref="siteOperationScheduleManager" />

    <!-- スケジュール複製コンポーネント -->
    <SiteOperationScheduleDuplicator
      v-bind="duplicatorComposable.attrs.value"
    />

    <!-- 通知ステータス更新コンポーネント -->
    <ArrangementNotificationManager
      ref="arrangementNotificationManager"
      includes-status
    />

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
