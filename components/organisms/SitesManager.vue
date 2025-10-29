<script setup>
/**
 * @file components/organisms/SitesManager.vue
 * @description A component to manage sites.
 */
import { useSitesManager } from "@/composables/useSitesManager";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { attrs } = useSitesManager();
</script>

<template>
  <air-array-manager v-bind="attrs"> </air-array-manager>
</template>
