<script setup>
import { onMounted, useTemplateRef } from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useWorkersList } from "@/composables/useWorkersList";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOrderManager } from "@/composables/useSiteOrderManager";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useArrangementManager } from "@/composables/useArrangementManager";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * DEFINE REFS
 *****************************************************************************/
const instance = reactive(new SiteOperationSchedule());
const scheduleManager = useTemplateRef("scheduleManager");
const siteOrderManager = useTemplateRef("siteOrderManager");
const duplicator = useTemplateRef("duplicator");
const tagSize = ref("default");
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

const { create: createNotifications, hasNotification } =
  useArrangementNotificationManager({
    dateRange,
  });

/** For floating window */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** For fetching and caching employees */
const fetchEmployeeComposable = useFetchEmployee();

/** For fetching and caching outsourcers */
const fetchOutsourcerComposable = useFetchOutsourcer();

/** For fetching and caching sites */
const fetchSiteComposable = useFetchSite();
const { cachedSites } = fetchSiteComposable;

/** For site-shiftType order */
const siteOrderManagerComposable = useSiteOrderManager({
  manager: siteOrderManager,
  fetchSiteComposable,
});
const { siteOrder, attrs } = siteOrderManagerComposable;

/** For providing a list of workers using `fetchEmployeeComposable` and `fetchOutsourcerComposable` */
const {
  availableEmployees,
  availableOutsourcers,
  initialize: initWorkers,
  getWorker,
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
      @click:site-order="siteOrderManagerComposable.open()"
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
      :site-order="siteOrder"
      :from="dateRange.from"
      :day-count="dayCount"
      v-model:selected-date="selectedDate"
    >
      <!-- site - shiftType row -->
      <template #site-row="{ siteId, shiftType }">
        <div v-if="cachedSites[siteId]" class="text-subtitle-1">
          <div class="d-flex align-center">
            <v-menu>
              <template #activator="{ props: activatorProps }">
                <v-btn
                  v-bind="activatorProps"
                  icon="mdi-dots-vertical"
                  size="small"
                  class="mr-2"
                  variant="plain"
                />
              </template>
              <v-list>
                <v-list-item
                  v-for="(item, index) in [
                    {
                      title: '予定登録',
                    },
                  ]"
                  :key="index"
                  :value="index"
                  @click="toCreate({ siteId, shiftType })"
                >
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
            <AtomsChipsShiftType class="mr-2" :shift-type="shiftType" />
            <span>{{ cachedSites[siteId].name }}</span>
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
              @click:notify="createNotifications"
            >
              <template #default="scheduleTagProps">
                <MoleculesDraggableWorkers v-bind="scheduleTagProps">
                  <template #default="draggableWorkersProps">
                    <MoleculesWorkerTag
                      v-bind="draggableWorkersProps"
                      :label="
                        getWorker(draggableWorkersProps.modelValue)?.displayName
                      "
                      :is-notificated="
                        hasNotification(draggableWorkersProps.key)
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
      :dialog-props="{ maxWidth: 480 }"
      :input-props="{
        excludedKeys: ['dayType', 'shiftType', 'employees', 'outsourcers'],
      }"
    />

    <!-- スケジュール複製ダイアログ -->
    <OrganismsSiteOperationScheduleDuplicator ref="duplicator" />

    <!-- 現場並び替えダイアログ -->
    <OrganismsSiteOrderManager ref="siteOrderManager" v-bind="attrs">
      <template #title="{ element }">
        {{ cachedSites[element.siteId].name }}
      </template>
    </OrganismsSiteOrderManager>
  </div>
</template>

<style scoped></style>
