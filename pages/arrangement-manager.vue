<script setup>
import { onMounted, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useWorkersList } from "@/composables/useWorkersList";
import { useSiteOrder } from "@/composables/useSiteOrder";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";
import { SHIFT_TYPE } from "air-guard-v2-schemas/constants";

/*****************************************************************************
 * PROPS / EMITS / REFS
 *****************************************************************************/
/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");
const tagSize = ref("medium");

/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
const { order } = useSiteOrder();
/** For floating window */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();
/** For fetching and caching employees */
const fetchEmployeeComposable = useFetchEmployee();
/** For fetching and caching outsourcers */
const fetchOutsourcerComposable = useFetchOutsourcer();
/** For providing a list of workers using `fetchEmployeeComposable` and `fetchOutsourcerComposable` */
const {
  availableEmployees,
  availableOutsourcers,
  initialize: initWorkers,
} = useWorkersList({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});
/** Manager composable */
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
  replaceDocs,
} = managerComposable;

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  // Initialize the workers list when the component is mounted.
  initWorkers();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!--
      TOOLBAR
    -->
    <ArrangementsToolbar
      v-model="dayCount"
      @click:workers="toggleFloatingWindow"
      @update:tag-size="tagSize = $event"
    />

    <!-- フローティング作業員選択ウィンドウ -->
    <MoleculesFloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <MoleculesWorkerSelector
        :employees="availableEmployees"
        :outsourcers="availableOutsourcers"
      >
        <template #employee="{ rawElement }">
          <MoleculesTagBase :label="rawElement.displayName" :size="tagSize" />
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
        <div v-if="cachedData.sites[siteId]" class="text-subtitle-1">
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
          @update:model-value="replaceDocs($event, siteId, shiftType, date)"
        >
          <template #default="draggableSiteOperationScheduleProps">
            <ArrangementsScheduleTag
              v-bind="draggableSiteOperationScheduleProps"
              class="mb-2"
              @click:edit="toUpdateSchedule"
            >
              <template #default="scheduleTagProps">
                <MoleculesDraggableWorkers v-bind="scheduleTagProps">
                  <template #default="draggableWorkersProps">
                    <MoleculesWorkerTag
                      v-bind="draggableWorkersProps"
                      :label="getWorkerName(draggableWorkersProps.modelValue)"
                      :size="tagSize"
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
