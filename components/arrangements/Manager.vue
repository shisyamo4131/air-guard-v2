<script setup>
/**
 * @file components/arrangements/Manager.vue
 * @description A component for managing site operation schedules, including viewing, creating, updating, and duplicating schedules.
 * It also provides functionalities for managing workers, site orders, and notifications.
 *
 * Note: コンポーザブルの読み込みに時間がかかっている模様（2025-10-02）
 * 改善の余地あり。
 * - Fetch 系は独立させて、それ以外のコンポーザブルは引数で Fetch 系のコンポーザブルを受け取るように統一する？
 * - provide - inject による遅延の可能性も無視できない？
 */
import { onMounted, useTemplateRef, provide } from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useTagSize } from "@/composables/useTagSize";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useWorkersList } from "@/composables/useWorkersList";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOrderManager } from "@/composables/useSiteOrderManager";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useArrangementManager } from "@/composables/useArrangementManager";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useSiteOperationScheduleDetailEditor } from "@/composables/useSiteOperationScheduleDetailEditor";
import { useArrangementSheetPdf } from "../../composables/pdf/useArrangementSheetPdf";

/*****************************************************************************
 * DEFINE REFS
 *****************************************************************************/
const instance = reactive(new SiteOperationSchedule());
const scheduleManager = useTemplateRef("scheduleManager");
const siteOrderManager = useTemplateRef("siteOrderManager");
const selectedDate = ref(null);
const commandText = ref(null);

/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
/** For tag size management */
const tagSizeComposable = useTagSize();
provide("tagSizeComposable", tagSizeComposable);

/** For date range management */
const { dateRange, currentDayCount: dayCount } = useDateRange({
  baseDate: new Date(),
  dayCount: 7,
  offsetDays: -1,
});

/** For arrangement notifications management */
const arrangementNotificationManagerComposable =
  useArrangementNotificationManager({ dateRange });
const {
  create: createNotification,
  get: getNotification,
  set: setNotification,
  attrs: notificationAttrs,
} = arrangementNotificationManagerComposable;

provide(
  "arrangementNotificationManagerComposable",
  arrangementNotificationManagerComposable
);

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
const {
  siteOrder,
  attrs,
  add: addSiteOrder,
  remove: removeSiteOrder,
} = siteOrderManagerComposable;

/** For providing a list of workers using `fetchEmployeeComposable` and `fetchOutsourcerComposable` */
const workersListComposable = useWorkersList({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});
const {
  availableEmployees,
  availableOutsourcers,
  initialize: initWorkers,
} = workersListComposable;

provide("workersListComposable", workersListComposable);

/** Manager composable */
const managerComposable = useArrangementManager({
  docs: instance.docs,
  manager: scheduleManager,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
});
const {
  statistics,
  docs,
  toCreate,
  toUpdate,
  optimisticUpdates,
  getCommandText,
} = managerComposable;

provide("managerComposable", managerComposable);

/** For site operation schedule duplication */
const duplicator = useSiteOperationScheduleDuplicator();

const detailEditor = useSiteOperationScheduleDetailEditor();
provide("detailEditorComposable", detailEditor);

const { open } = useArrangementSheetPdf({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
});

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
            :size="tagSizeComposable.current.value"
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
      @click:output-sheet="open"
      @click:command="($event) => (commandText = getCommandText($event))"
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
                      click: () => toCreate({ siteId, shiftType }),
                    },
                    {
                      title: '非表示化',
                      click: () => removeSiteOrder({ siteId, shiftType }),
                    },
                  ]"
                  :key="index"
                  :value="index"
                  @click="item.click"
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
          @update:model-value="
            optimisticUpdates($event, siteId, shiftType, date)
          "
        >
          <template #item="{ element: schedule }">
            <ArrangementsScheduleTag
              class="mb-2"
              :schedule="schedule"
              @click:duplicate="duplicator.set(schedule)"
              @click:edit="toUpdate(schedule)"
              @click:notify="createNotification(schedule)"
            >
              <template #default>
                <ArrangementsDraggableWorkers :schedule="schedule">
                  <template #item="draggableWorkersSlotProps">
                    <ArrangementsWorkerTag
                      v-bind="draggableWorkersSlotProps"
                      :notification="
                        getNotification(
                          draggableWorkersSlotProps.worker.notificationKey
                        )
                      "
                      @click:edit="detailEditor.set"
                      @click:notification="setNotification"
                    />
                  </template>
                </ArrangementsDraggableWorkers>
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
    <MoleculesSiteOperationScheduleManager
      ref="scheduleManager"
      :model-value="instance"
    />

    <!-- スケジュール複製ダイアログ -->
    <OrganismsSiteOperationScheduleDuplicator
      v-bind="duplicator.bindOptions.value"
    />

    <!-- 現場並び替えダイアログ -->
    <OrganismsSiteOrderManager ref="siteOrderManager" v-bind="attrs">
      <template #title="{ element }">
        {{ cachedSites[element.siteId].name }}
      </template>
    </OrganismsSiteOrderManager>

    <!-- 通知ステータス更新コンポーネント -->
    <ArrangementNotificationsStatusUpdater v-bind="notificationAttrs" />

    <!-- 作業員配置詳細情報編集コンポーネント -->
    <ArrangementsDetailEditor v-bind="detailEditor.bindOptions.value" />

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

    <!-- 不足現場勤務区分アラート -->
    <v-snackbar
      v-if="statistics.missingSiteOrders.length > 0"
      :model-value="!!statistics.missingSiteOrders.length"
      color="error"
      :timeout="-1"
    >
      <div>表示されていない現場稼働予定があります。</div>
      <div>・{{ statistics.missingSiteOrders[0].name }}</div>
      <template v-slot:actions>
        <v-btn @click="addSiteOrder(statistics.missingSiteOrders[0])"
          >追加表示する</v-btn
        >
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped></style>
