<script setup>
/*****************************************************************************
 * 稼働予定管理
 *****************************************************************************/
import dayjs from "dayjs";
import Toolbar from "./Toolbar";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationSchedules } from "@/composables/dataLayers/useSiteOperationSchedules";
import { useFetch } from "@/composables/fetch/useFetch";
import { useSiteOperationScheduleSelector } from "@/composables/useSiteOperationScheduleSelector";
import { useOperationScheduleTable } from "@/composables/useOperationScheduleTable";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

import { useSiteShiftTypeOrderEnriched } from "@/composables/dataLayers/siteShiftTypeOrder/useSiteShiftTypeOrderEnriched";
import { TYPE as ORDER_TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

import { useManagedDialog } from "@/composables/overlay/useManagedDialog";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useSiteShiftTypeOrderActions } from "~/composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions";

/** SETUP COMPOSABLES */
const { fetchSiteComposable } = useFetch("OperationSchedulesManager");

// dateRange コンポーザブル
// 初期表示は当月
const dateRangeComposable = useDateRange({
  baseDate: dayjs().tz().startOf("month").toDate(),
  endDate: dayjs().tz().endOf("month").toDate(),
});
const { debouncedDateRange } = dateRangeComposable;
provide("dateRangeComposable", dateRangeComposable);

// ドキュメント取得コンポーザブル
const { docs, statistics } = useSiteOperationSchedules({
  options: computed(() => [
    ["where", "dateAt", ">=", debouncedDateRange.value.from],
    ["where", "dateAt", "<=", debouncedDateRange.value.to],
  ]),
  fetchAllOnEmpty: true,
  fetchSiteComposable,
});

/*****************************************************************************
 * SETUP DATA LAYER COMPOSABLES
 *****************************************************************************/
// 現場勤務区分オーダー
const { siteShiftTypeOrder } = useSiteShiftTypeOrderEnriched({
  type: ORDER_TYPE.SCHEDULE,
  enrichmentOrders: docs,
});

/*****************************************************************************
 * SETUP DOMAIN COMPOSABLES
 *****************************************************************************/
// 現場勤務区分オーダー更新用アクション
const { canUpdate, isSaving, saveFailed, update, remove } =
  useSiteShiftTypeOrderActions({
    type: ORDER_TYPE.SCHEDULE,
  });
const siteShiftTypeOrderLogger = useLogger(
  "OperationSchedulesManagerSiteShiftTypeOrder",
  useErrorsStore(),
);

// 現場稼働予定管理用コンポーザブル
const siteOperationScheduleManager = useTemplateRef(
  "siteOperationScheduleManager",
);

// 現場稼働予定複製コンポーザブル
const duplicator = useSiteOperationScheduleDuplicator();

// 現場稼働予定テーブルコンポーザブル
const table = useOperationScheduleTable({
  schedules: docs,
  dayFormat: "DD",
  dateRangeComposable,
  fetchSiteComposable,
  siteShiftTypeOrder,
  columnWidth: 60,
});

// 現場稼働予定選択用コンポーザブル
const selector = useSiteOperationScheduleSelector({
  docs,
  fetchSiteComposable,
});

// 現場オーダー並び替え用ダイアログ
const reorderDialog = useManagedDialog({
  loggerName: "OperationSchedulesManagerSiteShiftTypeReorder",
  closeOnSubmit: true,
  onSubmit: update,
});

function openReorderDialog() {
  if (!canUpdate.value || isSaving.value) return;
  reorderDialog.open();
}

async function removeSiteShiftTypeOrder(orderKey) {
  if (!canUpdate.value || isSaving.value) return;
  try {
    await remove(orderKey);
  } catch (error) {
    siteShiftTypeOrderLogger.error({ error });
  }
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- ツールバー -->
    <Toolbar
      :can-sort="canUpdate"
      :sort-disabled="isSaving"
      @click:sort="openReorderDialog"
      @click:create="() => siteOperationScheduleManager.toCreate()"
    />

    <!-- スクロールコンテナ -->
    <div class="d-flex flex-grow-1 overflow-auto">
      <!-- メインコンテンツ: テーブル -->
      <OperationSchedulesTable
        v-bind="table.attrs.value"
        :can-edit-site-shift-type-order="canUpdate"
        :site-shift-type-order-saving="isSaving"
        @click:cell="selector.set"
        @click:remove-site-order="removeSiteShiftTypeOrder"
      >
        <!-- セル -->
        <template #cell="cellProps">
          <div class="py-2 d-flex justify-center">
            <SiteOperationScheduleRequiredPersonnelChip v-bind="cellProps" />
          </div>
        </template>

        <!-- フッター -->
        <template #footer="{ column }">
          <div class="d-flex justify-center">
            {{ statistics.get(column.dateAt)?.total || 0 }}
          </div>
        </template>
      </OperationSchedulesTable>
    </div>

    <!-- 現場稼働予定選択コンポーネント -->
    <AtomsDialogsFullscreen v-model="selector.dialog.value" max-width="480">
      <template #default>
        <SiteOperationScheduleSelector
          v-bind="selector.attrs.value"
          @click:create="() => siteOperationScheduleManager.toCreate($event)"
          @click:edit="
            ($event) => siteOperationScheduleManager.toUpdate($event)
          "
          @click:duplicate="duplicator.set($event)"
        />
      </template>
    </AtomsDialogsFullscreen>

    <!-- 現場稼働予定編集用コンポーネント -->
    <!-- <SiteOperationScheduleManager v-bind="manager.attrs.value" /> -->
    <SiteOperationScheduleManager ref="siteOperationScheduleManager" />

    <!-- 現場稼働予定複製コンポーネント -->
    <SiteOperationScheduleDuplicator v-bind="duplicator.attrs.value" />

    <!-- 現場オーダー並び替え用コンポーネント -->
    <AtomsDialogsFullscreen
      v-bind="reorderDialog.attrs.value"
      max-width="480"
      :persistent="reorderDialog.isLoading.value || isSaving"
    >
      <template #default>
        <SiteShiftTypeOrderReorderForm
          :site-shift-type-order="siteShiftTypeOrder"
          :disabled="!canUpdate"
          :loading="reorderDialog.isLoading.value || isSaving"
          :save-failed="saveFailed"
          @submit="reorderDialog.submit"
          @cancel="reorderDialog.cancel"
        >
          <template #title>並び替え</template>
          <template #subtitle>現場の並び順を変更できます。</template>
        </SiteShiftTypeOrderReorderForm>
      </template>
    </AtomsDialogsFullscreen>
  </div>
</template>
