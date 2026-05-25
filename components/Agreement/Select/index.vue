<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Select/index.vue
 * @description A select component of `Agreement (AgreementV2)`.
 * @extends AirSelect
 *****************************************************************************/

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "AgreementSelect", inheritAttrs: false });
</script>

<template>
  <air-select v-bind="$attrs" item-title="date" item-value="key">
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
