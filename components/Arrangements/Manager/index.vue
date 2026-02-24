<script setup>
/**
 * @file components/arrangements/Manager/index.vue
 * @description A component for managing site operation schedules, including viewing, creating, updating, and duplicating schedules.
 * It also provides functionalities for managing workers, site orders, and notifications.
 */
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useSiteOperationScheduleDetailManager } from "@/composables/useSiteOperationScheduleDetailManager";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";

// Components
import FloatingWindow from "@/components/molecules/FloatingWindow.vue";
import OperationSchedulesTable from "@/components/OperationSchedules/Table/index.vue";
import SpeedDial from "./SpeedDial.vue";

import { useIndex } from "./useIndex";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const managerComposable = useIndex();
const {
  // COMPOSABLES
  dateRangeComposable,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  siteShiftTypeReorderComposable,
  duplicatorComposable,

  // DATA
  schedules,
  employees,
  outsourcers,
  siteShiftTypeOrder,
  keyMappedNotifications,
  selectedDate,

  // METHODS
  isEmployeeArranged,
  notify,
  updateSchedule,
  updateSchedules,
  openPdf,
  getCommandText,
} = managerComposable;

/** For arrangement notification management */
const arrangementNotificationManager = useArrangementNotificationManager();

/** For site operation schedule management */
const siteOperationScheduleManager = useSiteOperationScheduleManager();

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
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- フローティング作業員選択ウィンドウ -->
    <FloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <MoleculesWorkerSelector
        :employees="employees"
        :outsourcers="outsourcers"
      >
        <template #employee="{ id }">
          <EmployeeTag
            is-draggable
            :doc-id="id"
            :fetch-employee-composable="fetchEmployeeComposable"
            :variant="isEmployeeArranged(id) ? 'disabled' : 'default'"
          />
        </template>
        <template #outsourcer="{ id }">
          <OutsourcerTag
            is-draggable
            :doc-id="id"
            :fetch-outsourcer-composable="fetchOutsourcerComposable"
          />
        </template>
      </MoleculesWorkerSelector>
    </FloatingWindow>

    <!-- スケジュール管理テーブル -->
    <OperationSchedulesTable
      class="fill-height"
      :start-date="dateRangeComposable.dateRange.value.from"
      :end-date="dateRangeComposable.dateRange.value.to"
      :schedules="schedules"
      :site-shift-type-order="siteShiftTypeOrder"
      :cached-sites="fetchSiteComposable.cachedSites.value"
      :column-width="256"
      day-format="MM/DD(ddd)"
      :selectedDate="selectedDate"
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
      <template #cell="{ date, siteId, shiftType, groupKey, schedules }">
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
                        keyMappedNotifications.get(
                          draggableWorkersProps.worker.notificationKey,
                        )
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
    <SiteOperationScheduleManager
      v-bind="siteOperationScheduleManager.attrs.value"
      :excludedKeys="['employees', 'outsourcers']"
    />

    <!-- スケジュール複製コンポーネント -->
    <SiteOperationScheduleDuplicator
      v-bind="duplicatorComposable.attrs.value"
    />

    <!-- 通知ステータス更新コンポーネント -->
    <OrganismsArrangementNotificationStatusUpdater
      v-bind="arrangementNotificationManager.attrs.value"
    />

    <!-- 作業員配置詳細情報編集コンポーネント -->
    <OrganismsSiteOperationScheduleDetailManager
      v-bind="siteOperationScheduleDetailManager.attrs.value"
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
      @click:add-schedule="siteOperationScheduleManager.toCreate"
      @click:site-shift-type-order="siteShiftTypeReorderComposable.open"
    />
  </div>
</template>

<style scoped></style>
