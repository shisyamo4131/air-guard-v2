<script setup>
/**
 * @file components/organisms/EmployeesManager.vue
 * @description A component to manage employees.
 * @author shisyamo4131
 */
import { useEmployeesManager } from "@/composables/useEmployeesManager";
/*****************************************************************************
 * COMPOSABLES
 *****************************************************************************/
const { attrs } = useEmployeesManager();
</script>

<template>
  <air-array-manager v-bind="attrs"> </air-array-manager>
</template>
