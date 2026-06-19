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

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "billings-customers-index" });

/*****************************************************************************
 * SETUP ROUTER
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP LOADINGS STORE
 *****************************************************************************/
const loadings = useLoadingsStore();

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().startOf("month").startOf("day").toDate();
const endDate = dayjs().endOf("month").endOf("day").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

/*****************************************************************************
 * SETUP BILLING PDF COMPOSABLE
 *****************************************************************************/
const { generateBillingPdf, generateConsolidatedBillingPdf } = useBillingPdf();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
// グループ行のPDF出力ボタンのクリックハンドラ
async function handleGroupPdfClick(item) {
  const key = loadings.add(`Creating billing PDF`);
  try {
    // item.items には、そのグループに属する全てのBillingドキュメントが入っている
    const billings = item.items.map((i) => i.raw);
    await generateConsolidatedBillingPdf(billings);
  } catch (error) {
    logger.error({ message: "Failed to create billing PDF", error });
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

// Manager
const { attrs, cachedCustomers } = useCustomerBillingsManager({
  dateRangeComposable,
  useDebounced: true,
  immediate: true,
});
</script>

<template>
  <v-container>
    <AirArrayManager v-bind="attrs" class="fill-height" ref="managerRef">
      <template #search>
        <MoleculesMonthSelector
          :model-value="dateRange.from"
          @date-range="dateRange = $event"
        />
      </template>
      <!-- グループヘッダーのカスタマイズ -->
      <template #group-header="{ item, toggleGroup, isGroupOpen }">
        <tr>
          <td :colspan="8">
            <v-btn
              class="me-2"
              :icon="isGroupOpen(item) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              variant="text"
              size="small"
              @click="toggleGroup(item)"
            ></v-btn>
            <strong>{{ item.value }}</strong>
            <v-chip class="ml-2" size="small">
              {{ item.items.length }}件
            </v-chip>
          </td>
          <td class="text-right">
            <!-- PDF出力ボタン -->
            <v-btn
              icon="mdi-file-pdf-box"
              size="small"
              class="ml-4"
              @click.stop="handleGroupPdfClick(item)"
            />
          </td>
        </tr>
      </template>

      <template #[`item.actions`]="{ item }">
        <!-- 編集ボタン -->
        <v-btn
          icon="mdi-pencil"
          size="small"
          @click="router.push(`/billings/customers/${item.docId}`)"
        />
        <!-- 現場ごとのPDF出力ボタン -->
        <v-btn
          icon="mdi-file-pdf-box"
          size="small"
          @click="handlePdfClick(item)"
        />
      </template>
    </AirArrayManager>
  </v-container>
</template>
