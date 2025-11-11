<script setup>
/*****************************************************************************
 * @file pages/settings/operation-results.vue
 * @description 稼働実績管理画面
 *****************************************************************************/
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useOperationResultsManager } from "@/composables/useOperationResultsManager";

const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;
const { attrs, set, cachedSites } = useOperationResultsManager({
  dateRangeComposable,
  useDebounced: true,
  immediate: true,
});
</script>

<template>
  <v-container>
    <air-array-manager v-bind="attrs">
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
  </v-container>
</template>
