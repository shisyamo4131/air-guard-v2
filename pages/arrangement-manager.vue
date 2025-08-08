<script setup>
import { onMounted, provide, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useWorkersList } from "@/composables/useWorkersList";
import { useLogger } from "@/composables/useLogger";
import { useSiteOrder } from "@/composables/useSiteOrder";

import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";
import { SHIFT_TYPE } from "air-guard-v2-schemas/constants";

/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");

/** フローティング作業員選択ウィンドウ用のコンポーザブル */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** define composables */
const logger = useLogger();
const { order } = useSiteOrder();

// for fetching and caching employees.
const fetchEmployeeComposable = useFetchEmployee();
// for fetching and caching outsourcers.
const fetchOutsourcerComposable = useFetchOutsourcer();
// for providing a list of workers using `fetchEmployeeComposable` and `fetchOutsourcerComposable`.
const {
  availableEmployees,
  availableOutsourcers,
  initialize: initWorkers,
} = useWorkersList({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});

const managerComposable = useSiteOperationSchedulesManager({
  manager: scheduleManager,
  from: dayjs().subtract(1, "day").toDate(),
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});

const {
  cachedData,
  dateRange,
  dayCount,
  keyMappedDocs,
  getWorkerName,
  toUpdate: toUpdateSchedule,
  itemManagerAttrs,
} = managerComposable;

/** provide composable to child components */
provide("scheduleManagerComposable", managerComposable);

onMounted(() => {
  // Initialize the workers list when the component is mounted.
  initWorkers();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * スケジュール日付変更処理（楽観的更新）
 */
async function handleChangeSchedule(event, date) {
  logger.clearError();
  const dateAt = new Date(date);
  try {
    if (event.added) {
      const schedule = event.added.element;
      await schedule.reschedule(dateAt);
    }
  } catch (error) {
    logger.error({
      sender: "handleChangeSchedule",
      message: error.message,
      error,
    });
  }
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <ArrangementsToolbar
      v-model="dayCount"
      @click:workers="toggleFloatingWindow"
    />

    <!-- フローティング作業員選択ウィンドウ -->
    <MoleculesFloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <MoleculesWorkerSelector
        :employees="availableEmployees"
        :outsourcers="availableOutsourcers"
      >
        <template #employee="{ rawElement }">
          <MoleculesTagBase :label="rawElement.displayName" />
        </template>
        <template #outsourcer="{ rawElement }">
          <MoleculesTagBase :label="rawElement.displayName" />
        </template>
      </MoleculesWorkerSelector>
    </MoleculesFloatingWindow>

    <!-- スケジュール管理テーブル -->
    <ArrangementsTable
      :site-order="order"
      :from="dateRange.from"
      :day-count="dayCount"
    >
      <!-- site - shiftType row -->
      <template #site-row="{ siteId, shiftType }">
        <div v-if="cachedData.sites[siteId]" class="text-subtitle-1 fixed-left">
          <div class="d-flex align-center">
            <v-chip class="mr-2" label size="small">
              {{ SHIFT_TYPE[shiftType] }}
            </v-chip>
            <span>{{ cachedData.sites[siteId].name }}</span>
          </div>
        </div>
        <v-progress-circular v-else indeterminate size="small" />
      </template>

      <!-- cell -->
      <template #body-cell="{ key, siteId, shiftType, date }">
        <MoleculesDraggableSiteOperationSchedule
          :model-value="keyMappedDocs[key] || []"
          :site-id="siteId"
          :shift-type="shiftType"
          :date="date"
          @change="handleChangeSchedule($event, date)"
          @click:edit="$emit('click:edit', $event)"
        >
          <template #default="{ element: schedule }">
            <ArrangementsScheduleTag
              :schedule="schedule"
              :cached-employees="cachedData.employees"
              :cached-outsourcers="cachedData.outsourcers"
              class="mb-2"
              @click:edit="toUpdateSchedule"
            >
              <template
                #default="{
                  handleChangeWorkers,
                  handleUpdateDetailStatus,
                  handleWorkerRemoved,
                }"
              >
                <MoleculesDraggableWorkers
                  :model-value="schedule.workers"
                  :disabled="!schedule.isWorkerChangeable"
                  @change="handleChangeWorkers($event, schedule)"
                >
                  <template #default="{ element: worker, highlighted }">
                    <MoleculesWorkerTag
                      :label="getWorkerName(worker)"
                      :highlight="highlighted"
                      :model-value="worker"
                      @update:status="handleUpdateDetailStatus(worker, $event)"
                      @click:remove="handleWorkerRemoved({ element: $event })"
                    />
                  </template>
                </MoleculesDraggableWorkers>
              </template>
            </ArrangementsScheduleTag>
          </template>
        </MoleculesDraggableSiteOperationSchedule>
      </template>

      <!-- footer -->
      <template #footer-cell>
        <span class="grey--text text--darken-2 text-subtitle-2"> 稼働数: </span>
      </template>
    </ArrangementsTable>

    <!-- スケジュール編集ダイアログ -->
    <ItemManager ref="scheduleManager" v-bind="itemManagerAttrs">
      <template #editor="{ editorProps, inputProps }">
        <MoleculesSiteOperationScheduleEditor
          v-bind="editorProps"
          :agreements="
            cachedData.sites[inputProps.item.siteId]?.agreements || []
          "
        />
      </template>
    </ItemManager>
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
