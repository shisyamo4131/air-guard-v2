<script setup>
/**
 * @file pages/settings/employees.vue
 * @description Employee management page
 */
import { useEmployeesManager } from "@/composables/useEmployeesManager";
/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
const { attrs } = useEmployeesManager();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" />
  </TemplatesFixedHeightContainer>
</template>
