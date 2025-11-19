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
const { getSite, searchSites } = fetchSiteComposable;

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
    <air-array-manager
      class="fill-height"
      v-bind="attrs"
      :input-props="{
        excludedKeys: [
          'employees',
          'outsourcers',
          'unitPriceBase',
          'overtimeUnitPriceBase',
          'unitPriceQualified',
          'overtimeUnitPriceQualified',
          'billingUnitType',
          'includeBreakInBilling',
          'cutoffDate',
          'isLocked',
          'billingDateAt',
          'useAdjustedQuantity',
          'adjustedQuantityBase',
          'adjustedOvertimeBase',
          'adjustedQuantityQualified',
          'adjustedOvertimeQualified',
        ],
      }"
    >
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
      <template #input.siteId="{ attrs, editMode }">
        <air-autocomplete-api
          v-bind="attrs"
          :api="searchSites"
          clearable
          :disabled="editMode !== 'CREATE'"
          :fetchItemByKeyApi="getSite"
          item-title="name"
          item-value="docId"
          label="現場"
          required
        />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
