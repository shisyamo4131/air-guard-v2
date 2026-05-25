<script setup>
/*****************************************************************************
 * @file ./pages/billings/operations/index.vue
 * @description A page component to display `OperationBillings`.
 *****************************************************************************/
import * as Vue from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
// ROUTER
const router = useRouter();

// Date Range
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange, debouncedDateRange } = dateRangeComposable;

// Fetch
const { fetchSiteComposable } = useFetch("OperationBillings", true);
const { fetchSite } = fetchSiteComposable;

// Data Layer
const options = Vue.computed(() => {
  return [
    ["where", "dateAt", ">=", debouncedDateRange.value.from],
    ["where", "dateAt", "<=", debouncedDateRange.value.to],
  ];
});
const { docs } = useDocuments(
  "OperationBilling",
  { options, fetchAllOnEmpty: true },
  (doc) => fetchSite(doc.siteId),
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handles the update action for an item.
 * @param item The item to be updated.
 */
function handleClickUpdate(item) {
  router.push(`/billings/operations/${item.docId}`);
}
</script>

<template>
  <v-container class="fill-height align-start">
    <OperationBillingsManager
      class="fill-height"
      :docs="docs"
      :handle-click-update="handleClickUpdate"
    >
      <!-- TABLE -->
      <template #table="tableProps">
        <OperationBillingsDataTable v-bind="tableProps">
          <template #top>
            <v-toolbar color="secondary" density="compact">
              <MoleculesMonthSelector
                :model-value="dateRange.from.value"
                @date-range="dateRange = $event"
              />
            </v-toolbar>
          </template>
        </OperationBillingsDataTable>
      </template>
    </OperationBillingsManager>
  </v-container>
</template>
