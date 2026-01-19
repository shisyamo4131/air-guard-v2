<script setup>
/*****************************************************************************
 * 現場稼働予定管理
 *****************************************************************************/
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationSchedules } from "@/composables/dataLayers/useSiteOperationSchedules";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useSiteOperationScheduleSelector } from "@/composables/useSiteOperationScheduleSelector";
import { useSiteOperationScheduleTable } from "@/composables/useSiteOperationScheduleTable";
import { useSiteOrder } from "@/composables/useSiteOrder";

/** SETUP COMPOSABLES */
const fetchSiteComposable = useFetchSite();

const dateRangeComposable = useDateRange({ dayCount: 60 });
const { dateRange } = dateRangeComposable;

// 現場オーダーコンポーザブル
const { siteOrder } = useSiteOrder({ fetchSiteComposable });

// ドキュメント取得コンポーザブル
const { docs, groupedDocs } = useSiteOperationSchedules({
  options: computed(() => [
    ["where", "dateAt", ">=", dateRange.value.from],
    ["where", "dateAt", "<=", dateRange.value.to],
  ]),
  fetchAllOnEmpty: true,
});

// 現場稼働予定管理用コンポーザブル
const manager = useSiteOperationScheduleManager();

// 現場稼働予定テーブルコンポーザブル
const table = useSiteOperationScheduleTable({
  docs,
  dateRangeComposable,
  fetchSiteComposable,
  siteOrder,
});

// 現場稼働予定選択用コンポーザブル
const selector = useSiteOperationScheduleSelector({
  docs,
  fetchSiteComposable,
  manager,
});
</script>

<template>
  <div class="d-flex fill-height">
    <!-- メインコンテンツ: テーブル -->
    <SiteOperationScheduleTable v-bind="table.attrs.value">
      <template #cell="{ siteId, shiftType, dateAt, groupKey }">
        <div class="py-2 d-flex justify-center">
          <SiteOperationScheduleRequiredPersonnelChip
            v-bind="groupedDocs.get(groupKey) || {}"
            @click="() => selector.set({ siteId, shiftType, dateAt, groupKey })"
          />
        </div>
      </template>
    </SiteOperationScheduleTable>

    <!-- 現場稼働予定選択コンポーネント -->
    <AtomsDialogsFullscreen v-model="selector.dialog.value" max-width="480">
      <template #default>
        <SiteOperationScheduleSelector v-bind="selector.attrs.value" />
      </template>
    </AtomsDialogsFullscreen>

    <!-- 現場稼働予定編集用コンポーネント -->
    <OrganismsSiteOperationScheduleManager
      v-bind="manager.attrs.value"
      :excluded-keys="['employees', 'outsourcers']"
    />
  </div>
</template>
