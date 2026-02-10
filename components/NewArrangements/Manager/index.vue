<script setup>
import { useDateRange } from "@/composables/useDateRange";
import { useOperationScheduleTable } from "@/composables/useOperationScheduleTable";
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
const { docs } = useSiteOperationSchedules({
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

const { attrs: tableAttrs } = useOperationScheduleTable({
  schedules: docs,
  dateRangeComposable,
  fetchSiteComposable,
  siteShiftTypeOrder,
  columnWidth: 240,
});
</script>

<template>
  <div class="d-flex flex-grow-1 overflow-auto fill-height">
    <!-- TABLE -->
    <OperationSchedulesTable v-bind="tableAttrs">
      <template #cell="cellProps">
        <DraggableOperationSchedules v-bind="cellProps">
          <template #default="draggableSchedulesProps">
            <SiteOperationScheduleCard v-bind="draggableSchedulesProps">
              <template #default="{ model }">
                <DraggableWorkers v-bind="model">
                  <template #default="DraggableWorkersProps">
                    <SiteOperationScheduleWorkerTag
                      v-bind="DraggableWorkersProps"
                    />
                  </template>
                </DraggableWorkers>
              </template>
            </SiteOperationScheduleCard>
          </template>
        </DraggableOperationSchedules>
      </template>
    </OperationSchedulesTable>
  </div>
</template>
