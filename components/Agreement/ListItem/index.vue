<script setup>
/*****************************************************************************
 * @file ./components/Agreement/ListItem/index.vue
 * @description A list-item component of `Agreement (AgreementV2)`.
 * @extends VListItem
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { AgreementV2 } from "@/schemas";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "AgreementListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  agreement: {
    type: Object,
    required: true,
    validator: (obj) => obj instanceof AgreementV2,
  },
  dayType: { type: String, default: "WEEKDAY" },
  showBillingUnitType: { type: Boolean, default: false },
  showPrices: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementListItem");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { DAY_TYPE, BILLING_UNIT_TYPE } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const dayTypeLabel = computed(() => {
  return DAY_TYPE.value?.[props.dayType]?.title || "N/A";
});
const billingUnitTypeLabel = computed(() => {
  const unitType =
    BILLING_UNIT_TYPE.value?.[props.agreement.billingUnitType]?.title || "N/A";
  return `請求単位: ${unitType}`;
});
const unitPriceBase = computed(() => {
  const price = props.agreement.rates?.[props.dayType]?.unitPriceBase;
  const localedPrice = price ? price.toLocaleString() : "-";
  return `${dayTypeLabel.value}基本: ${localedPrice} 円`;
});
const unitPriceQualified = computed(() => {
  const price = props.agreement.rates?.[props.dayType]?.unitPriceQualified;
  const localedPrice = price ? price.toLocaleString() : "-";
  return `${dayTypeLabel.value}資格: ${localedPrice} 円`;
});
const showSubtitle = computed(() => {
  return props.showBillingUnitType || props.showPrices;
});
</script>

<template>
  <v-list-item v-bind="$attrs">
    <template #title>
      <AgreementListItemTitle :agreement="props.agreement" />
    </template>
    <template #subtitle v-if="showSubtitle">
      <div class="d-flex flex-column">
        <span v-if="props.showPrices">
          {{ `${unitPriceBase} / ${unitPriceQualified}` }}
        </span>
        <span v-if="props.showBillingUnitType">
          {{ `${billingUnitTypeLabel}` }}
        </span>
      </div>
    </template>
  </v-list-item>
</template>
