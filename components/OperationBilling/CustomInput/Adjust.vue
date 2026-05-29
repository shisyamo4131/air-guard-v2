<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/CustomInput/Adjust.vue
 * @description 稼働請求ドキュメント 金額調整用カスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  item: {
    type: Object,
    required: true,
    validator: (obj) => obj instanceof OperationBilling,
  },
});
const props = useDefaults(_props, "OperationBillingCustomInputAdjust");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const tab = ref("quantity");
</script>

<template>
  <div class="pt-2">
    <v-alert
      class="text-caption"
      color="info"
      icon="mdi-information"
      density="compact"
      text="実際の稼働と異なる数量・単価での請求が必要な場合、調整後の数量・単価を入力してください。"
    />
    <air-checkbox v-bind="props.componentAttrs['useAdjusted']" hide-details />
    <v-tabs v-model="tab" color="primary" fixed-tabs>
      <v-tab value="quantity">数量</v-tab>
      <v-tab value="unitPrice">単価</v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <!-- 数量 -->
      <v-tabs-window-item value="quantity">
        <!-- 基本 -->
        <div class="d-flex ga-4 pt-4">
          <air-number-input
            :model-value="props.item.sales.original.base.quantity"
            label="基本数量"
            control-variant="hidden"
            readonly
            :precision="1"
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedQuantityBase']"
            control-variant="hidden"
            :precision="1"
          />
        </div>
        <div class="d-flex ga-4">
          <AtomsHourInput
            :model-value="props.item.sales.original.base.overtimeMinutes"
            label="基本残業時間"
            control-variant="hidden"
            readonly
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <AtomsHourInput
            v-bind="props.componentAttrs['adjustedOvertimeMinutesBase']"
            label="基本残業時間(調整後)"
            control-variant="hidden"
          />
        </div>
        <!-- 資格者 -->
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.qualified.quantity"
            label="資格数量"
            control-variant="hidden"
            readonly
            :precision="1"
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedQuantityQualified']"
            control-variant="hidden"
            :precision="1"
          />
        </div>
        <div class="d-flex ga-4">
          <AtomsHourInput
            :model-value="props.item.sales.original.qualified.overtimeMinutes"
            label="資格残業時間"
            control-variant="hidden"
            readonly
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <AtomsHourInput
            v-bind="props.componentAttrs['adjustedOvertimeMinutesQualified']"
            label="資格残業時間(調整後)"
            control-variant="hidden"
          />
        </div>
      </v-tabs-window-item>

      <!-- 単価 -->
      <v-tabs-window-item value="unitPrice">
        <!-- 基本 -->
        <div class="d-flex ga-4 pt-4">
          <air-number-input
            :model-value="props.item.sales.original.base.unitPrice"
            label="基本単価"
            control-variant="hidden"
            readonly
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedUnitPriceBase']"
            control-variant="hidden"
          />
        </div>
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.base.overtimeUnitPrice"
            label="基本残業単価"
            control-variant="hidden"
            readonly
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedOvertimeUnitPriceBase']"
            control-variant="hidden"
          />
        </div>
        <!-- 資格者 -->
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.qualified.unitPrice"
            label="資格単価"
            control-variant="hidden"
            readonly
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedUnitPriceQualified']"
            control-variant="hidden"
          />
        </div>
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.qualified.overtimeUnitPrice"
            label="資格残業単価"
            control-variant="hidden"
            readonly
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedOvertimeUnitPriceQualified']"
            control-variant="hidden"
          />
        </div>
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>
