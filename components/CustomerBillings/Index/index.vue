<script setup>
/*****************************************************************************
 * @file components/CustomerBillings/Index/index.vue
 * @description 取引先請求一覧機能のエントリーポイントです。
 *****************************************************************************/
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useDateRange } from "@/composables/useDateRange.js";
import { useBillingsInRange } from "@/composables/dataLayers/billing/useBillingsInRange";
import { useCustomerBillingActions } from "@/composables/application/customerBilling/useCustomerBillingActions";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerBillingsIndex", inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { downloadBillingPdf, downloadConsolidatedBillingPdf, downloadCsv } =
  useCustomerBillingActions();

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
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleEditClick(billing) {
  router.push(`/billings/customers/${billing.docId}`);
}
</script>

<template>
  <CustomerBillingsManager v-bind="$attrs" :docs="docs">
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
</template>
