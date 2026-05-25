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
    <v-expand-transition>
      <v-alert
        v-show="!props.item.agreement"
        class="mb-4"
        color="info"
        icon="mdi-information"
        density="compact"
        text="取極めが選択されていないため、請求処理が行われません。"
      />
    </v-expand-transition>
    <AgreementSelect
      v-bind="props.componentAttrs['agreement']"
      :items="agreements"
      variant="outlined"
      density="compact"
      return-object
      clearable
    />
    <v-alert
      class="mb-4"
      color="info"
      icon="mdi-information"
      density="compact"
      text="実際の稼働や取極めと異なる数量、金額での請求が必要な場合、調整後の数量・金額を入力してください。"
    />
    <air-checkbox
      v-bind="props.componentAttrs['useAdjustedQuantity']"
      label="数量・数量を調整する"
    />
    <!-- 基本 -->
    <div class="d-flex ga-4">
      <air-number-input
        :model-value="props.item.sales.base.quantity"
        label="基本人工数"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
      <v-icon class="mt-2" icon="mdi-chevron-right" />
      <air-number-input
        v-bind="props.componentAttrs['adjustedQuantityBase']"
        :disabled="!props.item.useAdjustedQuantity"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
    </div>
    <div class="d-flex ga-4">
      <air-number-input
        :model-value="props.item.sales.base.overtimeMinutes"
        label="基本残業時間（分）"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
      <v-icon class="mt-2" icon="mdi-chevron-right" />
      <air-number-input
        v-bind="props.componentAttrs['adjustedOvertimeBase']"
        :disabled="!props.item.useAdjustedQuantity"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
    </div>
    <!-- 資格者 -->
    <div class="d-flex ga-4">
      <air-number-input
        :model-value="props.item.sales.qualified.quantity"
        label="資格人工数"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
      <v-icon class="mt-2" icon="mdi-chevron-right" />
      <air-number-input
        v-bind="props.componentAttrs['adjustedQuantityQualified']"
        :disabled="!props.item.useAdjustedQuantity"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
    </div>
    <div class="d-flex ga-4">
      <air-number-input
        :model-value="props.item.sales.qualified.overtimeMinutes"
        label="資格残業時間（分）"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
      <v-icon class="mt-2" icon="mdi-chevron-right" />
      <air-number-input
        v-bind="props.componentAttrs['adjustedOvertimeQualified']"
        :disabled="!props.item.useAdjustedQuantity"
        variant="outlined"
        density="compact"
        control-variant="hidden"
      />
    </div>
  </div>
</template>
