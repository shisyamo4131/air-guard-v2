<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Table/BillingDetail.vue
 * @description A table component for displaying billing-detail.
 *
 * @property {Object} item - An object representing the billing item. Required and must be an instance of `OperationBilling`.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { formatNumber } from "@/utils/formats/util.js";
import { OperationBilling } from "@/schemas";

const componentName = "OperationBillingTableBillingDetail";
defineOptions({ name: componentName, inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationBilling,
  },
});
const props = useDefaults(_props, componentName);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const salesData = computed(() =>
  props.item.useAdjusted
    ? props.item.sales.adjusted
    : props.item.sales.original,
);
</script>

<template>
  <v-table density="compact">
    <thead>
      <tr>
        <th>項目</th>
        <th class="text-right">数量</th>
        <th class="text-right">単価</th>
        <th class="text-right">金額</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>基本</td>
        <td class="text-right">{{ formatNumber(salesData.base.quantity) }}</td>
        <td class="text-right">{{ formatNumber(salesData.base.unitPrice) }}</td>
        <td class="text-right">
          {{ formatNumber(salesData.base.regularAmount) }}
        </td>
      </tr>
      <tr>
        <td>基本残業</td>
        <td class="text-right">
          {{ formatNumber(salesData.base.overtimeMinutes) }}
        </td>
        <td class="text-right">
          {{ formatNumber(salesData.base.overtimeUnitPrice) }}
        </td>
        <td class="text-right">
          {{ formatNumber(salesData.base.overtimeAmount) }}
        </td>
      </tr>
      <tr>
        <td>資格</td>
        <td class="text-right">
          {{ formatNumber(salesData.qualified.quantity) }}
        </td>
        <td class="text-right">
          {{ formatNumber(salesData.qualified.unitPrice) }}
        </td>
        <td class="text-right">
          {{ formatNumber(salesData.qualified.regularAmount) }}
        </td>
      </tr>
      <tr>
        <td>資格残業</td>
        <td class="text-right">
          {{ formatNumber(salesData.qualified.overtimeMinutes) }}
        </td>
        <td class="text-right">
          {{ formatNumber(salesData.qualified.overtimeUnitPrice) }}
        </td>
        <td class="text-right">
          {{ formatNumber(salesData.qualified.overtimeAmount) }}
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="text-right">合計金額</td>
        <td class="text-right">
          {{ formatNumber(salesData.base.total + salesData.qualified.total) }}
        </td>
      </tr>
    </tfoot>
  </v-table>
</template>
