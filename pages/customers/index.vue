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
const options = [["where", "contractStatus", "==", "ACTIVE"]];
const { docs } = useDocuments("Customer", {
  options: toRef(options),
  fetchAllOnEmpty: true,
});
const { attrs } = useCustomersManager(
  { docs },
  {
    tableProps: {
      sortBy: [{ key: "code", order: "desc" }],
    },
  }
);
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" />
  </TemplatesFixedHeightContainer>
</template>
