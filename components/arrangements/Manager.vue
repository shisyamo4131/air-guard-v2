<script setup>
/**
 * @file components/arrangements/Manager.vue
 * @description A component for managing site operation schedules, including viewing, creating, updating, and duplicating schedules.
 * It also provides functionalities for managing workers, site orders, and notifications.
 */
import dayjs from "dayjs";
import { useTagSize } from "@/composables/useTagSize";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useDateRange } from "@/composables/useDateRange";
import { useArrangementsManager } from "@/composables/useArrangementsManager";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useSiteOperationScheduleDetailManager } from "@/composables/useSiteOperationScheduleDetailManager";
import { useSiteOrderManager } from "@/composables/useSiteOrderManager";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";
import { useArrangements } from "@/composables/dataLayers/useArrangements";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
/** Fetch composables for caching. */
const fetchEmployeeComposable = useFetchEmployee();
const fetchOutsourcerComposable = useFetchOutsourcer();
const fetchSiteComposable = useFetchSite();

/** For date range */
const dateRangeComposable = useDateRange({
  baseDate: dayjs().toDate(),
  dayCount: 7,
  offsetDays: -1,
});

/** data layer composable */
const { schedules, notifications, employees, outsourcers } = useArrangements({
  dateRangeComposable,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});

/** For arrangements management */
const arrangementsManager = useArrangementsManager({
  schedules,
  notifications,
  dateRangeComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
});
const { isEmployeeArranged } = arrangementsManager;

/** For arrangement notification management */
const arrangementNotificationManager = useArrangementNotificationManager();

/** For site operation schedule management */
const siteOperationScheduleManager = useSiteOperationScheduleManager();

/** For schedule duplication */
const duplicator = useSiteOperationScheduleDuplicator();

/** For schedule detail management */
const siteOperationScheduleDetailManager =
  useSiteOperationScheduleDetailManager();

/** For site order management */
const siteOrderManager = useSiteOrderManager();

/** For tag size management */
const tagSizeComposable = useTagSize();
provide("tagSizeComposable", tagSizeComposable);

/** For floating window */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** For arrangement sheet PDF generation */
const { open } = useArrangementSheetPdf({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchSiteComposable,
});

/*****************************************************************************
 * DEFINE REACTIVE OBJECTS
 *****************************************************************************/
// const selectedDate = ref(null);
const commandText = ref(null);

/*****************************************************************************
 * METHODS
 *****************************************************************************/

/*****************************************************************************
 * HELPER FUNCTIONS
 *****************************************************************************/
const getWorker = ({ id, isEmployee }) => {
  if (isEmployee) {
    return fetchEmployeeComposable.cachedEmployees.value[id] || null;
  } else {
    return fetchOutsourcerComposable.cachedOutsourcers.value[id] || null;
  }
};
provide("getWorker", getWorker); // Use in WorkerTag.vue
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- TOOLBAR -->
    <ArrangementsToolbar
      v-model="dateRangeComposable.currentDayCount.value"
      @click:workers="toggleFloatingWindow"
      @click:site-order="siteOrderManager.set"
      @click:add-schedule="siteOperationScheduleManager.toCreate"
    >
    </ArrangementsToolbar>

    <!-- フローティング作業員選択ウィンドウ -->
    <MoleculesFloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <MoleculesWorkerSelector
        :employees="employees"
        :outsourcers="outsourcers"
      >
        <template #employee="{ rawElement, id }">
          <MoleculesTagBase
            :label="rawElement.displayName"
            :size="tagSizeComposable.current.value"
            :variant="isEmployeeArranged(id) ? 'disabled' : 'default'"
          />
        </template>
        <template #outsourcer="{ rawElement }">
          <MoleculesTagBase :label="rawElement.displayName" />
        </template>
      </MoleculesWorkerSelector>
    </MoleculesFloatingWindow>

    <!-- スケジュール管理テーブル -->
    <ArrangementsTable
      v-bind="arrangementsManager.attrs.value.table"
      v-model:selected-date="arrangementsManager.selectedDate.value"
      :notifications="arrangementsManager.keyMappedNotifications.value"
      :site-order="siteOrderManager.siteOrder.value"
      @click:add-schedule="siteOperationScheduleManager.toCreate"
      @click:command="
        ($event) => (commandText = arrangementsManager.getCommandText($event))
      "
      @click:duplicate="duplicator.set"
      @click:edit="siteOperationScheduleManager.toUpdate"
      @click:edit-worker="siteOperationScheduleDetailManager.set"
      @click:hide="siteOrderManager.remove"
      @click:notify="arrangementsManager.notify"
      @click:notification="arrangementNotificationManager.toUpdate"
      @click:output-sheet="open"
    />

    <!-- 現場並び替えコンポーネント -->
    <AtomsDialogsFullscreen v-bind="siteOrderManager.dialogAttrs.value">
      <OrganismsSiteOrderManager v-bind="siteOrderManager.attrs.value" />
    </AtomsDialogsFullscreen>

    <!-- スケジュール編集コンポーネント -->
    <OrganismsSiteOperationScheduleManager
      v-bind="siteOperationScheduleManager.attrs.value"
      :excludedKeys="['employees', 'outsourcers']"
    />

    <!-- スケジュール複製コンポーネント -->
    <OrganismsSiteOperationScheduleDuplicator v-bind="duplicator.attrs.value" />

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

    <!-- 不足現場勤務区分アラート -->
    <v-snackbar
      v-if="arrangementsManager.statistics.value.missingSiteOrders.length > 0"
      :model-value="
        !!arrangementsManager.statistics.value.missingSiteOrders.length
      "
      color="error"
      :timeout="-1"
    >
      <div>表示されていない現場稼働予定があります。</div>
      <div>
        ・{{ arrangementsManager.statistics.value.missingSiteOrders[0].name }}
      </div>
      <template v-slot:actions>
        <v-btn
          @click="
            siteOrderManager.add(
              arrangementsManager.statistics.value.missingSiteOrders[0]
            )
          "
          >追加表示する</v-btn
        >
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped></style>
