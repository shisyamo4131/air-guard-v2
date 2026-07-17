<script setup>
/*****************************************************************************
 * @file pages/billings/customers/index.vue
 * @description 取引先請求一覧ページ
 *****************************************************************************/
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useDateRange } from "@/composables/useDateRange.js";
import { useCustomerBillingsManager } from "@/composables/useCustomerBillingsManager.js";
import { useBillingPdf } from "@/composables/pdf/useBillingPdf";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { exportOperationResultsCsv } from "@/utils/csv/exportOperationResultsCsv";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "billings-customers-index" });

/*****************************************************************************
 * SETUP ROUTER
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const loadings = useLoadingsStore();
const logger = useLogger("billings-customers-index", useErrorsStore());

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().startOf("month").startOf("day").toDate();
const endDate = dayjs().endOf("month").endOf("day").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

/*****************************************************************************
 * SETUP CUSTOMER BILLINGS MANAGER COMPOSABLE
 *****************************************************************************/
const { attrs, cachedSites } = useCustomerBillingsManager({
  dateRangeComposable,
  useDebounced: true,
  immediate: true,
});

/*****************************************************************************
 * SETUP BILLING PDF COMPOSABLE
 *****************************************************************************/
const { generateBillingPdf, generateConsolidatedBillingPdf } = useBillingPdf();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
// 編集ボタンのクリックハンドラ
function handleEditClick(billing) {
  router.push(`/billings/customers/${billing.docId}`);
}

// グループ行のPDF出力ボタンのクリックハンドラ
async function handleGroupPdfClick(billings) {
  const key = loadings.add(`Creating billing PDF`);
  try {
    await generateConsolidatedBillingPdf(billings);
  } catch (error) {
    logger.error({ message: "Failed to create billing PDF", error });
  } finally {
    loadings.remove(key);
  }
}

// グループ行のCSV出力ボタンのクリックハンドラ
async function handleGroupCsvClick(billings) {
  const key = loadings.add(`Creating billing CSV`);
  try {
    const operationResults = billings.flatMap(
      (billing) => billing.operationResults ?? [],
    );

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

// 現場ごとのPDF出力ボタンのクリックハンドラ（既存）
async function handlePdfClick(billing) {
  const key = loadings.add(`Creating billing PDF`);
  try {
    await generateBillingPdf(billing);
  } catch (error) {
    logger.error({ message: "Failed to create billing PDF", error });
  } finally {
    loadings.remove(key);
  }
}
</script>

<template>
  <v-container
    class="align-start"
    style="height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <AirArrayManager v-bind="attrs" class="fill-height" ref="managerRef">
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
  </v-container>
</template>
