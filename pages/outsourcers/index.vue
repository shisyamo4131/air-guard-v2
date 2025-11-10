<script setup>
/**
 * @file pages/settings/outsourcers.vue
 * @description Outsourcer management page
 */
import { useOutsourcersManager } from "@/composables/useOutsourcersManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useOutsourcersManager();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" />
  </TemplatesFixedHeightContainer>
</template>
