<script setup>
/*****************************************************************************
 * 現場稼働予定管理
 *****************************************************************************/
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationSchedules } from "@/composables/dataLayers/useSiteOperationSchedules";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useSiteOperationScheduleSelector } from "@/composables/useSiteOperationScheduleSelector";
import { useSiteOperationScheduleTable } from "@/composables/useSiteOperationScheduleTable";
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

// ドキュメント取得コンポーザブル
const { docs, groupKeyMappedDocs, statistics } = useSiteOperationSchedules({
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
const table = useSiteOperationScheduleTable({
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
    <v-toolbar class="flex-grow-0" color="secondary" density="compact">
      <v-toolbar-title class="ml-0">
        <div class="d-flex align-center">
          <v-btn
            icon="mdi-chevron-left"
            @click="dateRangeComposable.move({ value: -1, unit: 'month' })"
          />
          <span>
            {{
              dayjs(dateRangeComposable.dateRange.value.from).format(
                "YYYY年MM月",
              )
            }}
          </span>
          <v-btn
            icon="mdi-chevron-right"
            @click="dateRangeComposable.move({ value: 1, unit: 'month' })"
          />
        </div>
      </v-toolbar-title>
      <template #append>
        <v-btn icon="mdi-sort" @click="reorder.open" />
        <v-btn icon="mdi-plus" @click="manager.toCreate()" />
      </template>
    </v-toolbar>

    <!-- スクロールコンテナ -->
    <div class="d-flex flex-grow-1 overflow-auto">
      <!-- メインコンテンツ: テーブル -->
      <SiteOperationScheduleTable v-bind="table.attrs.value">
        <!-- セル -->
        <template #cell="{ siteId, shiftType, dateAt, groupKey }">
          <div class="py-2 d-flex justify-center">
            <SiteOperationScheduleRequiredPersonnelChip
              v-bind="groupKeyMappedDocs.get(groupKey) || {}"
              @click="
                () => selector.set({ siteId, shiftType, dateAt, groupKey })
              "
            />
          </div>
        </template>

        <!-- フッター -->
        <template #footer="{ dayObject }">
          <div class="d-flex justify-center">
            {{ statistics.get(dayObject.date)?.total || 0 }}
          </div>
        </template>
      </SiteOperationScheduleTable>
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
