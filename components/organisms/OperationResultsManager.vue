<script setup>
/*****************************************************************************
 * OperationResultsManager ver 1.0.0
 * @author shisyamo4131
 * @description A component to manage operation results.
 *****************************************************************************/
import dayjs from "dayjs";
import { useOperationResultsManager } from "@/composables/useOperationResultsManager";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { attrs, dateRange, cachedSites } = useOperationResultsManager();
</script>

<template>
  <air-array-manager v-bind="attrs">
    <template #search>
      <MoleculesMonthSelector @date-range="dateRange = $event" />
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
</template>
