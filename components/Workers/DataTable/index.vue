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
      <slot name="item.displayName" :item="item" :value="value">
        <AtomsIconsHasLicense v-if="item.isQualified" size="x-small" />
        {{ value }}
      </slot>
    </template>

    <!-- isOjt -->
    <template #[`item.isOjt`]="{ item }">
      <slot name="item.isOjt" :item="item"><OjtIcon :item="item" /></slot>
    </template>
    <template v-for="name in Object.keys($slots).filter((key) => !['item.displayName', 'item.isOjt'].includes(key))" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>
  </air-data-table>
</template>
