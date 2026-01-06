<script setup>
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useDateRange } from "@/composables/useDateRange.js";
import { useCustomerBillingsManager } from "@/composables/useCustomerBillingsManager.js";
import { useBillingPdf } from "@/composables/pdf/useBillingPdf";

defineOptions({ name: "billings-customers" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();

// Date Range
const baseDate = dayjs().startOf("month").startOf("day").toDate();
const endDate = dayjs().endOf("month").endOf("day").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

const { generateBillingPdf, generateConsolidatedBillingPdf } = useBillingPdf();

// グループ行のPDF出力ボタンのクリックハンドラ
async function handleGroupPdfClick(item) {
  // item.items には、そのグループに属する全てのBillingドキュメントが入っている
  const billings = item.items.map((i) => i.raw);
  await generateConsolidatedBillingPdf(billings);
}

// 現場ごとのPDF出力ボタンのクリックハンドラ（既存）
async function handlePdfClick(billing) {
  await generateBillingPdf(billing);
}

// Manager
const { attrs, cachedCustomers } = useCustomerBillingsManager({
  dateRangeComposable,
  useDebounced: true,
  immediate: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
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
              :icon="isGroupOpen(item) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              variant="text"
              size="small"
              @click="toggleGroup(item)"
            ></v-btn>
            <strong>{{ item.value }}</strong>
            <v-chip class="ml-2" size="small">
              {{ item.items.length }}件
            </v-chip>
            <!-- PDF出力ボタン -->
            <v-btn
              icon
              size="small"
              class="ml-4"
              @click.stop="handleGroupPdfClick(item)"
            >
              <v-icon>mdi-file-pdf-box</v-icon>
            </v-btn>
          </td>
        </tr>
      </template>

      <!-- 現場ごとのPDF出力ボタン -->
      <template #[`item.actions`]="{ item }">
        <v-btn
          icon
          size="small"
          @click="router.push(`/billings/customers/${item.docId}`)"
        >
          <v-icon>mdi-pencil</v-icon>
        </v-btn>
        <v-btn icon size="small" @click="handlePdfClick(item)">
          <v-icon>mdi-file-pdf-box</v-icon>
        </v-btn>
      </template>
    </AirArrayManager>
  </TemplatesFixedHeightContainer>
</template>
