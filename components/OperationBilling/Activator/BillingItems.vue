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
            <td>{{ props.item.sales.base.quantity }}</td>
            <td>{{ props.item.sales.base.unitPrice }}</td>
            <td>{{ props.item.sales.base.regularAmount }}</td>
          </tr>
          <tr>
            <td>基本残業</td>
            <td>{{ props.item.sales.base.overtimeMinutes }}</td>
            <td>{{ props.item.sales.base.overtimeUnitPrice }}</td>
            <td>{{ props.item.sales.base.overtimeAmount }}</td>
          </tr>
          <tr>
            <td>資格</td>
            <td>{{ props.item.sales.qualified.quantity }}</td>
            <td>{{ props.item.sales.qualified.unitPrice }}</td>
            <td>{{ props.item.sales.qualified.regularAmount }}</td>
          </tr>
          <tr>
            <td>資格残業</td>
            <td>{{ props.item.sales.qualified.overtimeMinutes }}</td>
            <td>{{ props.item.sales.qualified.overtimeUnitPrice }}</td>
            <td>{{ props.item.sales.qualified.overtimeAmount }}</td>
          </tr>
        </tbody>
      </v-table>
      <v-card-actions v-if="$slots.actions">
        <slot name="actions" />
      </v-card-actions>
    </template>
  </MoleculesActivatorCard>
</template>
