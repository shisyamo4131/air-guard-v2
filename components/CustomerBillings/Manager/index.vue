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
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useBillingPdf } from "@/composables/pdf/useBillingPdf";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { exportOperationResultsCsv } from "@/utils/csv/exportOperationResultsCsv";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerBillingsManager", inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const loadings = useLoadingsStore();
const logger = useLogger("CustomerBillingsManager", useErrorsStore());

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
 * SETUP SITE FETCH COMPOSABLE FOR CSV EXPORT
 *****************************************************************************/
const { fetchSite, cachedSites } = useFetchSite();

/*****************************************************************************
 * SETUP BILLING PDF COMPOSABLE
 *****************************************************************************/
const { generateBillingPdf, generateConsolidatedBillingPdf } = useBillingPdf();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleEditClick(billing) {
  router.push(`/billings/customers/${billing.docId}`);
}

async function handleGroupPdfClick(billings) {
  const key = loadings.add("Creating billing PDF");
  try {
    await generateConsolidatedBillingPdf(billings);
  } catch (error) {
    logger.error({ message: "Failed to create billing PDF", error });
  } finally {
    loadings.remove(key);
  }
}

async function handleGroupCsvClick(billings) {
  const key = loadings.add("Creating billing CSV");
  try {
    const operationResults = billings.flatMap(
      (billing) => billing.operationResults ?? [],
    );
    await fetchSite(operationResults);

    exportOperationResultsCsv({
      operationResults,
      cachedSites: cachedSites.value,
      fileName: "operation_results.csv", // 要改修: 関数はこの引数を受け取っていない。
    });
  } catch (error) {
    logger.error({ message: "Failed to create billing CSV", error });
  } finally {
    loadings.remove(key);
  }
}

async function handlePdfClick(billing) {
  const key = loadings.add("Creating billing PDF");
  try {
    await generateBillingPdf(billing);
  } catch (error) {
    logger.error({ message: "Failed to create billing PDF", error });
  } finally {
    loadings.remove(key);
  }
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
        @click:billing-pdf="handlePdfClick"
        @click:consolidated-billing-pdf="handleGroupPdfClick"
        @click:csv="handleGroupCsvClick"
      />
    </template>
  </AirArrayManager>
</template>
