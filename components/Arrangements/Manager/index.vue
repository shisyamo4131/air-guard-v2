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
 * @property {Date} startDate - スケジュール表示の開始日
 * @property {Date} endDate - スケジュール表示の終了日
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleDetailManager } from "@/composables/useSiteOperationScheduleDetailManager";
import { useArrangements } from "@/composables/dataLayers/useArrangements";

// Components
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
 * SETUP COMPOSABLES
 *****************************************************************************/
/** DATA LAYER */
const {
  schedules,
  getNotification,
  isEmployeeArranged: isEmployeeArrangedInDataLayer,
} = useArrangements({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});

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
const commandText = ref(null);

const siteOperationScheduleManager = useTemplateRef(
  "siteOperationScheduleManager",
);
const arrangementNotificationManager = useTemplateRef(
  "arrangementNotificationManager",
);
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- フローティング作業員選択ウィンドウ -->
    <FloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <ArrangementsWorkersSelector
        :is-employee-arranged="isEmployeeArrangedInDataLayer"
        :start-date="props.startDate"
        :end-date="props.endDate"
      />
    </FloatingWindow>

    <!-- スケジュール管理テーブル -->
    <OperationSchedulesTable
      class="fill-height"
      :start-date="props.startDate"
      :end-date="props.endDate"
      :schedules="schedules"
      :site-shift-type-order="siteShiftTypeOrder"
      :column-width="256"
      day-format="MM/DD(ddd)"
      :selectedDate="selectedDate"
      @click:add-schedule="
        ({ siteId, shiftType }) =>
          siteOperationScheduleManager.toCreate({ siteId, shiftType })
      "
      @click:remove-site-order="removeSiteShiftTypeOrder"
    >
      <!-- 日付の表示形式をカスタマイズ -->
      <template #append-day="{ dayObject, holidayIcon }">
        <v-icon v-if="dayObject.isHoliday" v-bind="holidayIcon" />
      </template>

      <!-- 曜日セルのカスタマイズ -->
      <template #weekday="{ dayObject, isSelected }">
        <div class="d-flex ga-6">
          <v-btn
            :icon="isSelected ? 'mdi-eye-off' : 'mdi-eye'"
            size="x-small"
            @click="selectedDate = dayObject.date"
          />
          <v-btn
            icon="mdi-table-large"
            size="x-small"
            @click="() => openPdf(dayObject.date)"
          />
          <v-btn
            icon="mdi-text-box-outline"
            size="x-small"
            @click="() => (commandText = getCommandText(dayObject.date))"
          />
        </div>
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
    <ArrangementNotificationManager ref="arrangementNotificationManager" />

    <!-- 作業員配置詳細情報編集コンポーネント -->
    <SiteOperationScheduleDetailManager
      v-bind="siteOperationScheduleDetailManager.attrs.value"
      hide-delete-btn
    />

    <!-- 配置テキスト表示ダイアログ -->
    <v-dialog
      :model-value="!!commandText"
      max-width="600"
      @update:model-value="commandText = null"
    >
      <v-card>
        <v-card-title class="text-h6">配置テキスト</v-card-title>
        <v-card-text>
          <v-textarea :value="commandText" rows="10" readonly outlined />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="commandText = null">閉じる</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
