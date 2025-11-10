<script setup>
/**
 * @file pages/settings/sites.vue
 * @description Site management page
 * @author shisyamo4131
 */
import { useSitesManager } from "@/composables/useSitesManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useSitesManager();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" />
  </TemplatesFixedHeightContainer>
</template>
