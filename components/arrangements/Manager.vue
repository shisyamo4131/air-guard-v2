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
import { useTemplateRef, provide } from "vue";
import { useTagSize } from "@/composables/useTagSize";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useSiteOperationScheduleDetailEditor } from "@/composables/useSiteOperationScheduleDetailEditor";

import dayjs from "dayjs";
import { useArrangementsManager } from "@/composables/useArrangementsManager";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useSiteOrderManager } from "@/composables/useSiteOrderManager";

/*****************************************************************************
 * DEFINE REFS
 *****************************************************************************/
const scheduleManager = useTemplateRef("scheduleManager");
const selectedDate = ref(null);
const commandText = ref(null);

/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/

/** modify code */
const arrangementsManager = useArrangementsManager({
  dateRangeOption: { endDate: dayjs().add(7, "day").toDate(), offsetDays: -1 },
});
provide("arrangementsManagerComposable", arrangementsManager);

const siteOperationScheduleManager =
  useSiteOperationScheduleManager(scheduleManager);

const siteOrderManager = useSiteOrderManager();

/** For site operation schedule duplication */
const duplicator = useSiteOperationScheduleDuplicator();

const detailEditor = useSiteOperationScheduleDetailEditor();
provide("detailEditorComposable", detailEditor);
/************* */

/** For tag size management */
const tagSizeComposable = useTagSize();
provide("tagSizeComposable", tagSizeComposable);

/** For floating window */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- TOOLBAR -->
    <ArrangementsToolbar
      v-model="arrangementsManager.dayCount.value"
      @click:workers="toggleFloatingWindow"
    >
      <template #btn-site-order="props">
        <AtomsDialogsFullscreen max-width="480" scrollable persistent>
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="{ ...props, ...activatorProps }" />
          </template>
          <template #default="{ isActive }">
            <MoleculesSiteOrderManager
              v-bind="siteOrderManager.attrs.value"
              @click:cancel="isActive.value = false"
            />
          </template>
        </AtomsDialogsFullscreen>
      </template>
    </ArrangementsToolbar>

    <!-- フローティング作業員選択ウィンドウ -->
    <MoleculesFloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <MoleculesWorkerSelector
        :employees="arrangementsManager.availableEmployees.value"
        :outsourcers="arrangementsManager.availableOutsourcers.value"
      >
        <template #employee="{ rawElement }">
          <MoleculesTagBase
            :label="rawElement.displayName"
            :size="tagSizeComposable.current.value"
            :variant="
              selectedDate &&
              arrangementsManager.statistics.value.arrangedEmployeesMap[
                selectedDate
              ].allDay.includes(rawElement.docId)
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
      :model-value="arrangementsManager.keyMappedDocs.value"
      :site-order="siteOrderManager.siteOrder.value"
      :from="arrangementsManager.dateRange.value.from"
      :day-count="arrangementsManager.dayCount.value"
      :statistics="arrangementsManager.statistics.value"
      v-model:selected-date="selectedDate"
      @click:output-sheet="arrangementsManager.generatePdf"
      @click:command="
        ($event) => (commandText = arrangementsManager.getCommandText($event))
      "
      @update:model-value="arrangementsManager.optimisticUpdates($event)"
      @change:workers="arrangementsManager.handleDraggableWorkerChangeEvent"
      @click:duplicate="duplicator.set($event)"
      @click:edit="siteOperationScheduleManager.toUpdate($event)"
      @click:edit-worker="detailEditor.set"
      @click:notify="arrangementsManager.createNotification($event)"
      @click:notification="arrangementsManager.setNotification"
      @click:remove-worker="arrangementsManager.removeWorker"
      @click:add-schedule="siteOperationScheduleManager.toCreate($event)"
      @click:hide="siteOrderManager.remove($event)"
    >
    </ArrangementsTable>

    <!-- スケジュール編集ダイアログ -->
    <MoleculesSiteOperationScheduleManager
      ref="scheduleManager"
      v-bind="siteOperationScheduleManager.attrs.value"
    />

    <!-- スケジュール複製ダイアログ -->
    <OrganismsSiteOperationScheduleDuplicator
      v-bind="duplicator.bindOptions.value"
    />

    <!-- 通知ステータス更新コンポーネント -->
    <ArrangementNotificationsStatusUpdater
      v-bind="arrangementsManager.notificationAttrs.value"
    />

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
