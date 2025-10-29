<script setup>
/**
 * @file components/organisms/OperationBillingsManager.vue
 * @description A component to manage operation billings.
 */
import dayjs from "dayjs";
import { useOperationBillingsManager } from "@/composables/useOperationBillingsManager";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { attrs } = useOperationBillingsManager();
</script>

<template>
  <air-array-manager v-bind="attrs">
    <template #item.dateAt="{ item }">
      <div>{{ dayjs(item.dateAt).format("MM月DD日(ddd)") }}</div>
    </template>
    <template #item.siteId="{ item }">
      <div v-if="cachedSites[item.siteId]">
        {{ cachedSites[item.siteId].name || "ERROR" }}
      </div>
      <v-progress-circular v-else indeterminate size="small" />
    </template>
  </air-array-manager>
</template>
