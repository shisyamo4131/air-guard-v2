<script setup>
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationScheduleTable } from "@/composables/useSiteOperationScheduleTable";
import { useSiteShiftTypeOrder } from "@/composables/dataLayers/useSiteShiftTypeOrder";
import { useSiteOperationSchedules } from "@/composables/dataLayers/useSiteOperationSchedules";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

const fetchSiteComposable = useFetchSite();
const fetchEmployeeComposable = useFetchEmployee();
const fetchOutsourcerComposable = useFetchOutsourcer();

const dateRangeComposable = useDateRange({
  baseDate: "2026-02-01",
  endDate: "2026-02-28",
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

const { siteShiftTypeOrder } = useSiteShiftTypeOrder({
  schedules: docs,
  fetchSiteComposable,
});

const { attrs: tableAttrs } = useSiteOperationScheduleTable({
  dateRangeComposable,
  fetchSiteComposable,
  siteShiftTypeOrder,
});
</script>

<template>
  <div class="d-flex flex-grow-1 overflow-auto fill-height">
    <SiteOperationScheduleTable v-bind="tableAttrs">
      <template #cell="cellProps">
        <SiteOperationScheduleDraggableSchedules
          v-bind="cellProps"
          :model-value="
            groupKeyMappedDocs.get(cellProps.groupKey)?.schedules || []
          "
        >
          <template #default="{ schedule }">
            <SiteOperationScheduleCard :schedule="schedule" />
          </template>
        </SiteOperationScheduleDraggableSchedules>
      </template>
    </SiteOperationScheduleTable>
  </div>
</template>
