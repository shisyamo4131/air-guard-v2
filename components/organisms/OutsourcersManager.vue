<script setup>
/**
 * @file components/organisms/OutsourcersManager.vue
 * @description A component to manage outsourcers.
 * @author shisyamo4131
 */
import { useOutsourcersManager } from "@/composables/useOutsourcersManager";
/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
const { attrs } = useOutsourcersManager();
</script>

<template>
  <air-array-manager v-bind="attrs"> </air-array-manager>
</template>
