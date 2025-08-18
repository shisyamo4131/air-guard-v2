<script setup>
import { onMounted, useTemplateRef } from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useWorkersList } from "@/composables/useWorkersList";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOrder } from "@/composables/useSiteOrder";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useArrangementManager } from "@/composables/useArrangementManager";
import { SHIFT_TYPE } from "air-guard-v2-schemas/constants";
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * DEFINE REFS
 *****************************************************************************/
const instance = reactive(new SiteOperationSchedule());
const scheduleManager = useTemplateRef("scheduleManager");
const duplicator = useTemplateRef("duplicator");
const tagSize = ref("medium");
const selectedDate = ref(null);

/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
/** For date range management */
const { dateRange, currentDayCount: dayCount } = useDateRange({
  baseDate: new Date(),
  dayCount: 7,
  offsetDays: -1,
});

/** For floating window */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** For fetching and caching employees */
const fetchEmployeeComposable = useFetchEmployee();
const { cachedEmployees } = fetchEmployeeComposable;

/** For fetching and caching outsourcers */
const fetchOutsourcerComposable = useFetchOutsourcer();
const { cachedOutsourcers } = fetchOutsourcerComposable;

/** For fetching and caching sites */
const fetchSiteComposable = useFetchSite();
const { cachedSites } = fetchSiteComposable;

/** For site-shiftType order */
const { order } = useSiteOrder({ fetchSiteComposable });

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
const managerComposable = useArrangementManager({
  docs: instance.docs,
  manager: scheduleManager,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
});
const { statistics, docs, toCreate, toUpdate, optimisticUpdates } =
  managerComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  dateRange,
  (newRange) => {
    instance.subscribeDocs({
      constraints: [
        ["where", "dateAt", ">=", newRange.from],
        ["where", "dateAt", "<=", newRange.to],
      ],
    });
  },
  { immediate: true }
);

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
    <!-- TOOLBAR -->
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
          <MoleculesTagBase
            :label="rawElement.displayName"
            :size="tagSize"
            :variant="
              selectedDate &&
              statistics.arrangedEmployeesMap[selectedDate].allDay.includes(
                rawElement.docId
              )
                ? 'disabled'
                : 'default'
            "
          />
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
      v-model:selected-date="selectedDate"
    >
      <!-- site - shiftType row -->
      <template #site-row="{ siteId, shiftType }">
        <div v-if="cachedSites[siteId]" class="text-subtitle-1">
          <div class="d-flex align-center">
            <v-chip class="mr-2" label size="small">
              {{ SHIFT_TYPE[shiftType] }}
            </v-chip>
            <span>{{ cachedSites[siteId].name }}</span>
            <v-icon
              icon="mdi-file-document-plus-outline"
              @click="toCreate({ siteId, shiftType })"
            />
          </div>
        </div>
        <v-progress-circular v-else indeterminate size="small" />
      </template>

      <!-- cell -->
      <template #body-cell="{ key, siteId, shiftType, date }">
        <MoleculesDraggableSiteOperationSchedule
          :model-value="docs[key] || []"
          :site-id="siteId"
          :shift-type="shiftType"
          :date="date"
          @update:model-value="
            optimisticUpdates($event, siteId, shiftType, date)
          "
        >
          <template #default="draggableSiteOperationScheduleProps">
            <ArrangementsScheduleTag
              v-bind="draggableSiteOperationScheduleProps"
              class="mb-2"
              @click:edit="toUpdate"
              @click:duplicate="duplicator.set($event)"
            >
              <template #default="scheduleTagProps">
                <MoleculesDraggableWorkers v-bind="scheduleTagProps">
                  <template #default="draggableWorkersProps">
                    <MoleculesWorkerTag
                      v-bind="draggableWorkersProps"
                      :label="
                        draggableWorkersProps.modelValue.isEmployee
                          ? cachedEmployees[
                              draggableWorkersProps.modelValue.workerId
                            ]?.displayName
                          : cachedOutsourcers[
                              draggableWorkersProps.modelValue.workerId
                            ]?.displayName
                      "
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
      <template #footer-cell="{ date }">
        <span class="grey--text text--darken-2 text-subtitle-2">{{
          `稼働数: ${statistics.requiredPersonnel[date] || 0}`
        }}</span>
      </template>
    </ArrangementsTable>

    <!-- スケジュール編集ダイアログ -->
    <ItemManager
      ref="scheduleManager"
      :model-value="instance"
      :dialog-props="{ maxWidth: 600 }"
      :input-props="{
        excludedKeys: ['status', 'employees', 'outsourcers'],
      }"
    >
      <template #editor="{ editorProps, inputProps }">
        <MoleculesSiteOperationScheduleEditor
          v-bind="editorProps"
          :agreements="cachedSites[inputProps.item.siteId]?.agreements || []"
        />
      </template>
    </ItemManager>

    <!-- スケジュール複製ダイアログ -->
    <OrganismsSiteOperationScheduleDuplicator ref="duplicator" />
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
