<script setup>
/**
 * @file pages/settings/customers.vue
 * @description Customer management page
 * @author shisyamo4131
 */
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useCustomersManager } from "@/composables/useCustomersManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { docs } = useDocuments("Customer", {
  constraints: [["where", "contractStatus", "==", "ACTIVE"]],
});
const { attrs } = useCustomersManager({ docs });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" no-title />
  </TemplatesFixedHeightContainer>
</template>
