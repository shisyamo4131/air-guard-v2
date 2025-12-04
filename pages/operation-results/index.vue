<script setup>
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useOperationResultsManager } from "@/composables/useOperationResultsManager";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
// Date Range
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

const fetchSiteComposable = useFetchSite();

// Manager
const { attrs, cachedSites } = useOperationResultsManager({
  dateRangeComposable,
  useDebounced: true,
  fetchSiteComposable,
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
      <template #item.siteId="{ item }">
        <div v-if="cachedSites[item.siteId]">
          <div>{{ cachedSites[item.siteId].name }}</div>
          <div>{{ cachedSites[item.siteId].customer.name }}</div>
        </div>
        <v-progress-circular v-else indeterminate size="small" />
      </template>
      <template #input.siteId="{ attrs }">
        <MoleculesAutocompleteSite
          v-bind="attrs"
          creatable
          :fetch-site-composable="fetchSiteComposable"
        />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
