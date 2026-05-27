<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Activator/BillingItems.vue
 * @description 稼働請求ドキュメントの請求内訳表示コンポーネント
 * - `OperationBillingManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";
// COMPONENTS
import CustomInput from "@/components/OperationBilling/CustomInput/Adjust.vue";

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
const props = useDefaults(_props, "OperationBillingActivatorBillingItems");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const salesData = computed(() =>
  props.item.useAdjusted
    ? props.item.sales.adjusted
    : props.item.sales.original,
);

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({ customInput: CustomInput });
</script>

<template>
  <MoleculesActivatorCard>
    <!-- Toolbar Action を置換 -->
    <template #toolbar-action="slotProps">
      <v-btn
        v-bind="slotProps"
        append-icon="mdi-pencil"
        text="数量・単価を調整"
      />
    </template>

    <!-- DEFAULT SLOT にコンテンツを配置 -->
    <template #default>
      <v-table>
        <thead>
          <tr>
            <th>項目</th>
            <th>数量</th>
            <th>単価</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>基本</td>
            <td>{{ salesData.base.quantity }}</td>
            <td>{{ salesData.base.unitPrice }}</td>
            <td>{{ salesData.base.regularAmount }}</td>
          </tr>
          <tr>
            <td>基本残業</td>
            <td>{{ salesData.base.overtimeMinutes }}</td>
            <td>{{ salesData.base.overtimeUnitPrice }}</td>
            <td>{{ salesData.base.overtimeAmount }}</td>
          </tr>
          <tr>
            <td>資格</td>
            <td>{{ salesData.qualified.quantity }}</td>
            <td>{{ salesData.qualified.unitPrice }}</td>
            <td>{{ salesData.qualified.regularAmount }}</td>
          </tr>
          <tr>
            <td>資格残業</td>
            <td>{{ salesData.qualified.overtimeMinutes }}</td>
            <td>{{ salesData.qualified.overtimeUnitPrice }}</td>
            <td>{{ salesData.qualified.overtimeAmount }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right">合計金額</td>
            <td>{{ salesData.totalAmount }}</td>
          </tr>
        </tfoot>
      </v-table>
      <v-card-actions v-if="$slots.actions">
        <slot name="actions" />
      </v-card-actions>
    </template>
  </MoleculesActivatorCard>
</template>
