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

import { useSiteShiftTypeOrderEnriched } from "@/composables/dataLayers/siteShiftTypeOrder/useSiteShiftTypeOrderEnriched";
import { TYPE as ORDER_TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

import { useManagedDialog } from "@/composables/overlay/useManagedDialog";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useSiteShiftTypeOrderActions } from "~/composables/domain/siteShiftTypeOrder/useSiteShiftTypeOrderActions";

/** SETUP COMPOSABLES */
const { fetchSiteComposable } = useFetch("OperationSchedulesManager");

// dateRange コンポーザブル
// 初期表示は当月
const dateRangeComposable = useDateRange({
  baseDate: dayjs().startOf("month").toDate(),
  endDate: dayjs().endOf("month").toDate(),
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
const { update } = useSiteShiftTypeOrderActions({
  type: ORDER_TYPE.SCHEDULE,
});

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
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- ツールバー -->
    <Toolbar
      @click:sort="reorderDialog.open"
      @click:create="() => siteOperationScheduleManager.toCreate()"
    />

    <!-- スクロールコンテナ -->
    <div class="d-flex flex-grow-1 overflow-auto">
      <!-- メインコンテンツ: テーブル -->
      <OperationSchedulesTable
        v-bind="table.attrs.value"
        @click:cell="selector.set"
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
    <AtomsDialogsFullscreen v-model="reorderDialog.isOpen.value" max-width="480">
      <template #default>
        <SiteShiftTypeOrderReorderForm
          :site-shift-type-order="siteShiftTypeOrder"
          :loading="reorderDialog.isLoading.value"
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
