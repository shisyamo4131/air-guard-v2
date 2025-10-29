<script setup>
/**
 * @file components/organisms/CustomersManager.vue
 * @description A component to manage customers.
 * @author shisyamo4131
 */
import { useCustomersManager } from "@/composables/useCustomersManager";
/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
const { attrs } = useCustomersManager();
</script>

<template>
  <air-array-manager v-bind="attrs"> </air-array-manager>
</template>
