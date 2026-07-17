<script setup>
/*****************************************************************************
 * @file ./components/CustomerBillings/Manager/index.vue
 * @description 取引先請求一覧の表示と各種アクションを管理します。
 * @extends AirArrayManager
 *****************************************************************************/
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { Billing } from "@/schemas";
import { useDateRange } from "@/composables/useDateRange.js";
import { useBillingsInRange } from "@/composables/dataLayers/billing/useBillingsInRange";
import { useCustomerBillingActions } from "@/composables/application/customerBilling/useCustomerBillingActions";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerBillingsManager", inheritAttrs: false });

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

function rejectCreate() {
  throw new Error("Creation of customer billings is not supported");
}

function rejectUpdate() {
  throw new Error("Update of customer billings is not supported");
}

function rejectDelete() {
  throw new Error("Deletion of customer billings is not supported");
}
</script>

<template>
  <AirArrayManager
    v-bind="$attrs"
    :model-value="docs"
    :schema="Billing"
    :handle-create="rejectCreate"
    :handle-update="rejectUpdate"
    :handle-delete="rejectDelete"
    hide-create-btn
  >
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
  </AirArrayManager>
</template>
