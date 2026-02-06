<script setup>
/*****************************************************************************
 * 稼働予定管理
 *****************************************************************************/
import dayjs from "dayjs";
import Toolbar from "./Toolbar";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationSchedules } from "@/composables/dataLayers/useSiteOperationSchedules";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useSiteOperationScheduleSelector } from "@/composables/useSiteOperationScheduleSelector";
import { useOperationScheduleTable } from "@/composables/useOperationScheduleTable";
import { useSiteShiftTypeOrder } from "@/composables/dataLayers/useSiteShiftTypeOrder";
import { useSiteShiftTypeReorder } from "@/composables/useSiteShiftTypeReorder";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";

/** SETUP COMPOSABLES */
const fetchSiteComposable = useFetchSite();

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

// 現場オーダーコンポーザブル
const { siteShiftTypeOrder, update } = useSiteShiftTypeOrder({
  type: "schedule",
  schedules: docs,
  fetchSiteComposable,
});

// 現場稼働予定管理用コンポーザブル
const manager = useSiteOperationScheduleManager();

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
  manager,
});

// 現場オーダー並び替え用コンポーザブル
const reorder = useSiteShiftTypeReorder({
  items: siteShiftTypeOrder,
  onUpdate: update,
});
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- ツールバー -->
    <Toolbar @click:sort="reorder.open" @click:create="manager.toCreate()" />

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
        <template #footer="{ dayObject }">
          <div class="d-flex justify-center">
            {{ statistics.get(dayObject.date)?.total || 0 }}
          </div>
        </template>
      </OperationSchedulesTable>
    </div>

    <!-- 現場稼働予定選択コンポーネント -->
    <AtomsDialogsFullscreen v-model="selector.dialog.value" max-width="480">
      <template #default>
        <SiteOperationScheduleSelector
          v-bind="selector.attrs.value"
          @click:create="manager.toCreate($event)"
          @click:edit="manager.toUpdate($event)"
          @click:duplicate="duplicator.set($event)"
        />
      </template>
    </AtomsDialogsFullscreen>

    <!-- 現場稼働予定編集用コンポーネント -->
    <SiteOperationScheduleManager
      v-bind="manager.attrs.value"
      :excluded-keys="['employees', 'outsourcers']"
    />

    <!-- 現場稼働予定複製コンポーネント -->
    <SiteOperationScheduleDuplicator v-bind="duplicator.attrs.value" />

    <!-- 現場オーダー並び替え用コンポーネント -->
    <AtomsDialogsFullscreen v-model="reorder.dialog.value" max-width="480">
      <template #default>
        <SiteShiftTypeOrderReorder v-bind="reorder.attrs.value">
          <template #title>並び替え</template>
          <template #subtitle>現場の並び順を変更できます。</template>
        </SiteShiftTypeOrderReorder>
      </template>
    </AtomsDialogsFullscreen>
  </div>
</template>
