<script setup>
/*****************************************************************************
 * @file pages/billings/customers/index.vue
 * @description 取引先請求一覧ページ
 *****************************************************************************/
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useFetch } from "@/composables/fetch/useFetch";
import { useDateRange } from "@/composables/useDateRange.js";
import { useBillingsInRange } from "@/composables/dataLayers/billing/useBillingsInRange";
import { useCustomerBillingActions } from "@/composables/application/customerBilling/useCustomerBillingActions";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "billings-customers-index" });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const fetchComposables = useFetch("billings-customers-index", true);
const { downloadBillingPdf, downloadConsolidatedBillingPdf, downloadCsv } =
  useCustomerBillingActions(fetchComposables);

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().startOf("month").startOf("day").toDate();
const endDate = dayjs().endOf("month").endOf("day").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange, debouncedStartDate, debouncedEndDate } = dateRangeComposable;

/*****************************************************************************
 * SETUP BILLINGS DATA LAYER
 *****************************************************************************/
const { docs } = useBillingsInRange({
  from: debouncedStartDate,
  to: debouncedEndDate,
  fetchCustomerComposable: fetchComposables.fetchCustomerComposable,
  fetchSiteComposable: fetchComposables.fetchSiteComposable,
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleEditClick(billing) {
  router.push(`/billings/customers/${billing.docId}`);
}
</script>

<template>
  <v-container
    class="align-start"
    style="height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <CustomerBillingsManager class="fill-height" :docs="docs">
      <template #table="slotProps">
        <v-toolbar class="mb-4 bg-transparent" density="compact">
          <MoleculesMonthSelector
            :model-value="dateRange.from"
            @date-range="dateRange = $event"
          />
        </v-toolbar>
        <CustomerBillingsDataTable
          class="flex-grow-1 overflow-y-hidden"
          v-bind="slotProps"
          @click:edit="handleEditClick"
          @click:billing-pdf="downloadBillingPdf"
          @click:consolidated-billing-pdf="downloadConsolidatedBillingPdf"
          @click:csv="downloadCsv"
        />
      </template>
    </CustomerBillingsManager>
  </v-container>
</template>
