<script setup>
/*****************************************************************************
 * @file components/CustomerBillings/DataTable/GroupSummaryRow.vue
 * @description 取引先請求グループの集計行を表示します。
 *****************************************************************************/
import { formatCurrency } from "@/utils/formats/util";
import { calculateTaxBreakdown } from "@/utils/billings/calculateTaxBreakdown";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  billings: { type: Array, default: () => [] },
  isOpen: { type: Boolean, default: false },
});
const emit = defineEmits(["click:toggle"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const summary = computed(() => {
  const result = props.billings.reduce(
    (result, billing) => {
      result.operationCount += billing.operationResults?.length ?? 0;
      result.subtotal += billing.subtotal ?? 0;
      return result;
    },
    {
      operationCount: 0,
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
    },
  );

  const taxBreakdown = calculateTaxBreakdown(
    props.billings.flatMap((billing) => billing.operationResults ?? []),
  );
  result.taxAmount = taxBreakdown.reduce(
    (sum, item) => sum + item.taxAmount,
    0,
  );
  result.totalAmount = result.subtotal + result.taxAmount;

  return result;
});
</script>

<template>
  <tr class="bg-grey-lighten-4 font-weight-bold">
    <!-- グループ制御列 -->
    <td>
      <v-btn
        :icon="props.isOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        variant="text"
        size="small"
        @click="emit('click:toggle')"
      />
    </td>
    <!-- 請求日・現場 -->
    <td colspan="2" class="text-end">合計</td>
    <td class="text-center">
      {{ summary.operationCount.toLocaleString() }}
    </td>
    <td class="text-end">{{ formatCurrency(summary.subtotal) }}</td>
    <td class="text-end">{{ formatCurrency(summary.taxAmount) }}</td>
    <td class="text-end">{{ formatCurrency(summary.totalAmount) }}</td>
    <!-- 入金予定日・アクション -->
    <td colspan="2"></td>
  </tr>
</template>
