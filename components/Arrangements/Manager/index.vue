<script setup>
/*****************************************************************************
 * @file components/arrangements/Manager/index.vue
 * @description A component for managing site operation schedules, including viewing, creating, updating, and duplicating schedules.
 * It also provides functionalities for managing workers, site orders, and notifications.
 *
 * [改修]
 * - `fetchXxxComposable` はルートコンポーネントで保持するように修正✅
 * - `dateRangeComposable` を `useIndex` から分離✅
 * - `schedules`, `notifications` をデータレイヤーから取得するように修正✅
 *
 * [更新履歴]
 * 2026-06-22 - 集中モード機能を開発者のみ利用可能に修正。
 *              → 集中モード on 時の機能について再検討。
 *            - `selectableEmployees`, `selectableOutsourcers` をデータレイヤーから取得し、provide するように修正。
 *
 * @property {Date} startDate - スケジュール表示の開始日
 * @property {Date} endDate - スケジュール表示の終了日
 *****************************************************************************/
import { useDefaults, useGoTo } from "vuetify";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleDetailManager } from "@/composables/useSiteOperationScheduleDetailManager";

// DATA LAYER COMPOSABLES
import { useArrangements } from "@/composables/dataLayers/useArrangements";
import { useEmployeesInRange } from "@/composables/dataLayers/useEmployeesInRange";
import { useOutsourcersInRange } from "@/composables/dataLayers/useOutsourcersInRange";

// Components
import TableWeekdayActions from "./TableWeekdayActions.vue";
import CommandTextDialog from "./CommandTextDialog.vue";
import SiteShiftTypeJumpMenu from "./SiteShiftTypeJumpMenu.vue";
import FloatingWindow from "@/components/molecules/FloatingWindow.vue";
import SpeedDial from "./SpeedDial.vue";

import { useIndex } from "./useIndex";

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
 * SETUP AUTH STORE
 *****************************************************************************/
const goTo = useGoTo();

/*****************************************************************************
 * SETUP DATA LAYER COMPOSABLE
 * - `props.startDate`, `props.endDate` で指定された期間の配置管理に関わる
 *   データを取得・提供します。
 *****************************************************************************/
const { schedules, getNotification, isEmployeeArranged } = useArrangements({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});
provide("isEmployeeArranged", isEmployeeArranged); // ArrangementsWorkerSelector で使用

/*****************************************************************************
 * SETUP EMPLOYEES IN RANGE COMPOSABLE
 * - `props.startDate`, `props.endDate` で指定された期間に在職中である
 *   Employee インスタンスの配列を取得・提供します。
 *****************************************************************************/
const { docs: selectableEmployees } = useEmployeesInRange({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});
provide("selectableEmployees", selectableEmployees); // 子コンポーネントに提供

/*****************************************************************************
 * SETUP OUTSOURCERS IN RANGE COMPOSABLE
 * - `props.startDate`, `props.endDate` で指定された期間に契約中である
 *   Outsourcer インスタンスの配列を取得・提供します。
 *****************************************************************************/
const { docs: selectableOutsourcers } = useOutsourcersInRange({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});
provide("selectableOutsourcers", selectableOutsourcers); // 子コンポーネントに提供

/*****************************************************************************
 * SETUP MANAGER COMPOSABLE
 *****************************************************************************/
const managerComposable = useIndex(schedules);
const {
  // COMPOSABLES
  siteShiftTypeReorderComposable,
  duplicatorComposable,

  // DATA
  siteShiftTypeOrder,
  selectedDate,
  notify,
  updateSchedule,
  updateSchedules,
  openPdf,
  getCommandText,
  removeSiteShiftTypeOrder,
} = managerComposable;

/** For schedule detail management */
const siteOperationScheduleDetailManager =
  useSiteOperationScheduleDetailManager();

/** For floating window */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/*****************************************************************************
 * DEFINE REACTIVE OBJECTS
 *****************************************************************************/
const arrangementCommandText = ref(null);
const siteShiftTypeJumpListMenu = ref(false);
const siteShiftTypeJumpListMenuTarget = ref(null);

/*****************************************************************************
 * DEFINE TEMPLATE REFS
 *****************************************************************************/
const siteOperationScheduleManager = useTemplateRef(
  "siteOperationScheduleManager",
);
const arrangementNotificationManager = useTemplateRef(
  "arrangementNotificationManager",
);
const operationTable = useTemplateRef("operationTable");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * `siteOperationScheduleManager` の `toCreate` メソッドを実行します。
 * @param {string} options.siteId - 現場ドキュメントID
 * @param {string} options.shiftType - 勤務区分
 */
async function handleClickAddSchedule({ siteId, shiftType }) {
  await siteOperationScheduleManager.value.toCreate({ siteId, shiftType });
}

async function openSiteShiftTypeJumpListMenu(evt) {
  if (siteShiftTypeJumpListMenu.value) {
    siteShiftTypeJumpListMenu.value = false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  siteShiftTypeJumpListMenuTarget.value = evt.target.closest(".v-btn");
  siteShiftTypeJumpListMenu.value = true;
}

function scrollToSiteShiftTypeOrder(evt) {
  const siteOrder = evt.id;
  const target = document.getElementById(siteOrder.key);
  const container =
    operationTable.value?.$el?.querySelector(".v-table__wrapper");
  if (!target || !container) return;
  const offset = -80; // ヘッダーの高さ分だけスクロール位置を調整
  goTo(target, { container, duration: 250, offset });
}
</script>

<template>
  <div class="fill-height">
    <!-- フローティング作業員選択ウィンドウ -->
    <FloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <ArrangementsWorkerSelector />
    </FloatingWindow>

    <!-- 現場勤務区分ジャンプメニュー -->
    <SiteShiftTypeJumpMenu
      v-model="siteShiftTypeJumpListMenu"
      :target="siteShiftTypeJumpListMenuTarget"
      :site-shift-type-order="siteShiftTypeOrder"
      @click:select="scrollToSiteShiftTypeOrder"
    />

    <!-- スケジュール管理テーブル -->
    <OperationSchedulesTable
      ref="operationTable"
      class="fill-height"
      :start-date="props.startDate"
      :end-date="props.endDate"
      :schedules="schedules"
      :site-shift-type-order="siteShiftTypeOrder"
      :column-width="256"
      day-format="MM/DD(ddd)"
      :selectedDate="selectedDate"
      @click:add-schedule="handleClickAddSchedule"
      @click:remove-site-order="removeSiteShiftTypeOrder"
    >
      <!-- 日付の表示形式をカスタマイズ -->
      <template #append-day="{ column, holidayIcon }">
        <v-icon v-if="column.isHoliday" v-bind="holidayIcon" />
      </template>

      <!-- 曜日セルのカスタマイズ -->
      <template #weekday="{ column, isSelected }">
        <TableWeekdayActions
          :column="column"
          :is-selected="isSelected"
          @click:focus="selectedDate = $event"
          @click:pdf="openPdf($event)"
          @click:command-text="arrangementCommandText = getCommandText($event)"
          @click:jump-list="openSiteShiftTypeJumpListMenu($event)"
        />
      </template>

      <!-- セルのカスタマイズ -->
      <template #cell="{ date, siteId, shiftType, schedules }">
        <DraggableOperationSchedules
          :date="date"
          :shift-type="shiftType"
          :site-id="siteId"
          :schedules="schedules"
          @update:schedules="updateSchedules($event)"
        >
          <template #default="{ schedule }">
            <!--
              現場稼働予定カードコンポーネント
              - `update:schedule` イベントは `DraggableWorkers` によって作業員の追加や削除、順序変更が行われた場合に発火。
              - 作業員配置情報以外の情報更新は `update:edit` イベントを受けて `SiteOperationScheduleManager` で行われる。
            -->
            <SiteOperationScheduleCard
              class="mb-2"
              style="border: 1px dashed grey"
              is-draggable
              :schedule="schedule"
              show-actions
              @click:duplicate="duplicatorComposable.set(schedule)"
              @click:notify="notify(schedule)"
              @click:edit="siteOperationScheduleManager.toUpdate(schedule)"
              @update:schedule="updateSchedule($event)"
            >
              <template #default="cardProps">
                <DraggableWorkers v-bind="cardProps.model">
                  <template #default="draggableWorkersProps">
                    <!--
                      draggableWorkerProps: { worker, schedule, highlight, isDraggable, removable, onClick:remove }
                    -->
                    <SiteOperationScheduleWorkerTag
                      v-bind="draggableWorkersProps"
                      :notification="
                        getNotification(draggableWorkersProps.worker)
                      "
                      @click:edit="
                        siteOperationScheduleDetailManager.set({
                          schedule: draggableWorkersProps.schedule,
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
    </OperationSchedulesTable>

    <!-- 現場オーダー並び替え用コンポーネント -->
    <AtomsDialogsFullscreen
      v-model="siteShiftTypeReorderComposable.dialog.value"
      max-width="480"
    >
      <template #default>
        <SiteShiftTypeOrderReorder
          v-bind="siteShiftTypeReorderComposable.attrs.value"
        >
          <template #title>並び替え</template>
          <template #subtitle>現場－勤務区分の並び順を変更できます。</template>
        </SiteShiftTypeOrderReorder>
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
    <SiteOperationScheduleDetailManager
      v-bind="siteOperationScheduleDetailManager.attrs.value"
      hide-delete-btn
    />

    <!-- 配置テキスト表示ダイアログ -->
    <CommandTextDialog v-model="arrangementCommandText" />

    <!-- スピードダイアル -->
    <SpeedDial
      app
      location="bottom right"
      color="primary"
      @click:workers="toggleFloatingWindow"
      @click:add-schedule="() => siteOperationScheduleManager.toCreate()"
      @click:site-shift-type-order="siteShiftTypeReorderComposable.open"
    />
  </div>
</template>

<style scoped></style>
