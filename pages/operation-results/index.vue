<script setup>
/*****************************************************************************
 * @file pages/operation-results/index.vue
 * @description 稼働実績一覧ページ
 *****************************************************************************/
import * as Vue from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "operation-results-index" });

/*****************************************************************************
 * SETUP ROUTER
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange, debouncedDateRange } = dateRangeComposable;

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchCustomerComposable, fetchSiteComposable } = useFetch(
  "OperationResults",
  true,
);
const { fetchCustomer, cachedCustomersArray } = fetchCustomerComposable;
const { fetchSite, cachedSitesArray } = fetchSiteComposable;

/*****************************************************************************
 * SETUP DATA LAYER
 *****************************************************************************/
const options = Vue.computed(() => {
  return [
    ["where", "dateAt", ">=", debouncedDateRange.value.from],
    ["where", "dateAt", "<=", debouncedDateRange.value.to],
  ];
});
const { docs } = useDocuments(
  "OperationResult",
  { options, fetchAllOnEmpty: true },
  (doc) => {
    fetchSite(doc.siteId);
    fetchCustomer(doc.customerId);
  },
);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const selectedCustomerId = ref(null);
const selectedSiteId = ref(null);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const filteredDocs = computed(() => {
  return docs.filter((doc) => {
    const matchesCustomer =
      !selectedCustomerId.value || doc.customerId === selectedCustomerId.value;
    const matchesSite =
      !selectedSiteId.value || doc.siteId === selectedSiteId.value;
    return matchesCustomer && matchesSite;
  });
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handles the update action for an item.
 * @param item The item to be updated.
 */
function handleClickUpdate(item) {
  router.push(`/operation-results/${item.docId}`);
}

function handleCreated(item) {
  router.push(`/operation-results/${item.docId}`);
}
</script>

<template>
  <v-container class="fill-height align-start">
    <OperationResultsManager
      class="fill-height"
      :docs="docs"
      :handle-click-update="handleClickUpdate"
      @create="handleCreated"
    >
      <!-- TABLE -->
      <template #table="tableProps">
        <v-toolbar color="secondary" flat density="compact">
          <MoleculesMonthSelector
            :model-value="dateRange.from.value"
            @date-range="dateRange = $event"
          />
          <v-spacer />
          <v-btn icon="mdi-plus" @click="() => tableProps.toCreate()" />
        </v-toolbar>
        <v-toolbar>
          <div class="px-4 flex-grow-1 d-flex ga-4">
            <CustomerSelect
              v-model="selectedCustomerId"
              clearable
              hide-details
              :items="cachedCustomersArray"
            />
            <SiteSelect
              v-model="selectedSiteId"
              clearable
              hide-details
              :items="cachedSitesArray"
            />
          </div>
        </v-toolbar>
        <OperationResultsDataTable
          class="flex-grow-1"
          v-bind="{ ...tableProps, items: filteredDocs }"
          hide-search
        />
      </template>
    </OperationResultsManager>
  </v-container>
</template>
