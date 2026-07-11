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
import { useDefaults } from "vuetify";

// DATA LAYER COMPOSABLES
import { useArrangementsInRange } from "@/composables/dataLayers/useArrangementsInRange";

// OVERLAY COMPOSABLES
import { useFloatingWindow } from "@/composables/overlay/useFloatingWindow";
import { useTargetedMenu } from "@/composables/overlay/useTargetedMenu";

// DOMAIN COMPOSABLES
import { useSiteOperationScheduleActions } from "@/composables/domain/siteOperationSchedule/useSiteOperationScheduleActions";

// Components
import TableWeekdayActions from "./TableWeekdayActions.vue";
import CommandTextDialog from "./CommandTextDialog.vue";
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
 * SETUP DATA LAYER COMPOSABLE
 * - `props.startDate`, `props.endDate` で指定された期間の配置管理に関わる
 *   データを取得・提供します。
 *****************************************************************************/
const {
  schedules,
  getNotification,
  isEmployeeArranged,
  selectableEmployees,
  selectableOutsourcers,
} = useArrangementsInRange({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});

/*****************************************************************************
 * SETUP OVERLAY COMPOSABLE
 *****************************************************************************/
/** Targeted menu for SiteShiftTypeListJumpMenu */
const {
  isOpen: siteShiftTypeJumpListMenu,
  target: siteShiftTypeJumpListMenuTarget,
  open: openSiteShiftTypeJumpListMenu,
} = useTargetedMenu({ target: ".v-btn" });

/** Floating window for ArrangementsWorkerSelector */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/*****************************************************************************
 * SETUP DOMAIN COMPOSABLES
 *****************************************************************************/
const { notify, updateSchedule, updateSchedules } =
  useSiteOperationScheduleActions();

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
  openPdf,
  getCommandText,

  // METHODS
  updateSiteShiftTypeOrder,
  removeSiteShiftTypeOrder,
} = managerComposable;

/*****************************************************************************
 * DEFINE REACTIVE OBJECTS
 *****************************************************************************/
const arrangementCommandText = ref(null);
const rowKeyToScroll = ref(null); // OperationSchedulesTable のスクロール用

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

/*****************************************************************************
 * PROVIDES
 *****************************************************************************/
/** ArrangementsWorkerSelector で使用 */
provide("isEmployeeArranged", isEmployeeArranged);
provide("selectableEmployees", selectableEmployees);
provide("selectableOutsourcers", selectableOutsourcers);
</script>

<template>
  <div class="fill-height">
    <!-- フローティング作業員選択ウィンドウ -->
    <FloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <ArrangementsWorkerSelector />
    </FloatingWindow>

    <!-- 現場勤務区分ジャンプメニュー -->
    <v-menu
      v-model="siteShiftTypeJumpListMenu"
      :target="siteShiftTypeJumpListMenuTarget"
    >
      <!-- @click:select の $event.id は siteShiftType オブジェクト -->
      <SiteShiftTypeOrderList
        :site-shift-type-order="siteShiftTypeOrder"
        density="compact"
        @click:select="({ id }) => (rowKeyToScroll = id.key)"
      />
    </v-menu>

    <!-- スケジュール管理テーブル -->
    <OperationSchedulesTable
      class="fill-height"
      v-model:scroll-to-row-key="rowKeyToScroll"
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
                        workerManager.toUpdate({
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
        <SiteShiftTypeOrderReorderManager
          v-bind="siteShiftTypeReorderComposable.attrs.value"
        >
          <template #title>並び替え</template>
          <template #subtitle>現場－勤務区分の並び順を変更できます。</template>
        </SiteShiftTypeOrderReorderManager>
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
