<script setup>
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useOperationBillingsManager } from "@/composables/useOperationBillingsManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
// Date Range
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

// Manager
const { attrs, cachedSites } = useOperationBillingsManager({
  dateRangeComposable,
  useDebounced: true,
  immediate: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs">
      <template #search>
        <MoleculesMonthSelector
          :model-value="dateRange.from"
          @date-range="dateRange = $event"
        />
      </template>
      <template #item.dateAt="{ item }">
        <div>{{ dayjs(item.dateAt).format("MM月DD日(ddd)") }}</div>
      </template>
      <template #item.siteId="{ item }">
        <div v-if="cachedSites[item.siteId]">
          <div>{{ cachedSites[item.siteId].name }}</div>
          <div>{{ cachedSites[item.siteId].customer.name }}</div>
        </div>
        <v-progress-circular v-else indeterminate size="small" />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
