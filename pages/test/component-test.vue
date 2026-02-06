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
});
</script>

<template>
  <div class="d-flex flex-grow-1 overflow-auto fill-height">
    <!-- TABLE -->
    <OperationSchedulesTable v-bind="tableAttrs">
      <template #cell="{ siteId, shiftType, date, schedules }">
        <!-- DRAGGABLE SCHEDULES -->
        <SiteOperationScheduleDraggableSchedules
          v-bind="{ siteId, shiftType, date }"
          :model-value="schedules"
        >
          <template #default="{ schedule }">
            <!-- SCHEDULE CARD -->
            <SiteOperationScheduleCard :schedule="schedule">
              <template #default>
                <!-- DRAGGABLE WORKERS -->
                <!-- <SiteOperationScheduleDraggableWorkers>
                  <template #default="{ worker, isDraggable }">
                    <SiteOperationScheduleWorker
                      :worker="worker"
                      :is-draggable="isDraggable"
                    />
                  </template>
                </SiteOperationScheduleDraggableWorkers> -->
              </template>
            </SiteOperationScheduleCard>
          </template>
        </SiteOperationScheduleDraggableSchedules>
      </template>
    </OperationSchedulesTable>
  </div>
</template>
