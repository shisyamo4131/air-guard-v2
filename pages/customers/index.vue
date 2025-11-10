<script setup>
/**
 * @file pages/settings/customers.vue
 * @description Customer management page
 * @author shisyamo4131
 */
import { useCustomersManager } from "@/composables/useCustomersManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useCustomersManager();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" />
  </TemplatesFixedHeightContainer>
</template>
