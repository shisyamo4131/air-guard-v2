<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/CustomInput/Adjust.vue
 * @description 稼働請求ドキュメント 金額調整用カスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";
// COMPOSABLES
import { useFetch } from "@/composables/fetch/useFetch";

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
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("OperationBillingCustomInputAdjust");
const { cachedSites, fetchSite } = fetchSiteComposable;

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const tab = ref("quantity");

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.item,
  (newItem) => {
    if (newItem?.siteId) fetchSite(newItem.siteId);
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const agreements = computed(() => {
  const site = cachedSites.value?.[props.item.siteId];
  return site?.agreementsV2 || [];
});
</script>

<template>
  <div class="pt-2">
    <AgreementSelect
      v-bind="props.componentAttrs['agreement']"
      :items="agreements"
      clearable
      return-object
    />
    <v-alert
      class="text-caption"
      color="info"
      icon="mdi-information"
      density="compact"
      text="取極めや実際の稼働と異なる数量、単価、請求締日での請求が必要な場合、調整後の数量・単価・請求締日を入力してください。"
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
            label="基本人工数"
            control-variant="hidden"
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedQuantityBase']"
            control-variant="hidden"
          />
        </div>
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.base.overtimeMinutes"
            label="基本残業時間（分）"
            control-variant="hidden"
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedOvertimeMinutesBase']"
            control-variant="hidden"
          />
        </div>
        <!-- 資格者 -->
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.qualified.quantity"
            label="資格人工数"
            control-variant="hidden"
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedQuantityQualified']"
            control-variant="hidden"
          />
        </div>
        <div class="d-flex ga-4">
          <air-number-input
            :model-value="props.item.sales.original.qualified.overtimeMinutes"
            label="資格残業時間（分）"
            control-variant="hidden"
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedOvertimeMinutesQualified']"
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
          />
          <v-icon class="mt-2" icon="mdi-chevron-right" />
          <air-number-input
            v-bind="props.componentAttrs['adjustedOvertimeUnitPriceQualified']"
            control-variant="hidden"
          />
        </div>
      </v-tabs-window-item>
    </v-tabs-window>
    <air-date-input
      v-bind="props.componentAttrs['billingDateAt']"
      density="compact"
      variant="outlined"
    />
  </div>
</template>
