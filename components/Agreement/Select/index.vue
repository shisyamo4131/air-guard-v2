<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Select/index.vue
 * @description A select component of `Agreement (AgreementV2)`.
 * @extends AirSelect
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "AgreementSelect", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  noDataText: { type: String, default: "取極めが登録されていません。" },
});
const props = useDefaults(_props, "AgreementSelect");
const emit = defineEmits([]);
</script>

<template>
  <air-select
    v-bind="$attrs"
    item-title="date"
    item-value="key"
    :no-data-text="props.noDataText"
  >
    <template #selection="{ item }">
      <AgreementListItemTitle :agreement="item.raw" />
    </template>
    <template #item="{ item, props }">
      <AgreementListItem
        v-bind="props"
        :agreement="item.raw"
        show-prices
        show-billing-unit-type
      />
    </template>
  </air-select>
</template>
