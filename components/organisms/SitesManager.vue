<script setup>
/**
 * @file components/organisms/SitesManager.vue
 * @description A component to manage sites.
 * @author shisyamo4131
 */
import { useSitesManager } from "@/composables/useSitesManager";
/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
const { attrs } = useSitesManager();
</script>

<template>
  <air-array-manager v-bind="attrs" />
</template>
