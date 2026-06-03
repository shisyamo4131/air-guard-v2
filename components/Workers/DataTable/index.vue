<script setup>
/*****************************************************************************
 * @file ./components/Workers/DataTable/index.vue
 * @description A data table component to manage `Workers (SiteOperationDetail or OperationResultDetail)`.
 *****************************************************************************/
import { useIndex } from "./useIndex.js";
import OjtIcon from "./OjtIcon";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "WorkersDataTable", inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useIndex();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <air-data-table v-bind="{ ...$attrs, ...attrs }">
    <!-- displayName -->
    <!-- Adds `HasLicense` icon if the worker is qualified -->
    <template #[`item.displayName`]="{ item, value }">
      <AtomsIconsHasLicense v-if="item.isQualified" size="x-small" />
      {{ value }}
    </template>

    <!-- isOjt -->
    <template #[`item.isOjt`]="{ item }">
      <OjtIcon :item="item" />
    </template>
  </air-data-table>
</template>
