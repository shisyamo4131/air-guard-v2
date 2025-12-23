<script setup>
/**
 * @file pages/settings/outsourcers.vue
 * @description Outsourcer management page
 *
 * NOTE:
 * - 現状、すべて外注先をサブスクライブしているが、将来的にフィルタリングする可能性あり。
 */
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useOutsourcersManager } from "@/composables/useOutsourcersManager";

/** SETUP DATA LAYER */
const { docs } = useDocuments("Outsourcer", {
  fetchAllOnEmpty: true,
});
const { attrs } = useOutsourcersManager(
  { docs, redirectPath: null },
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
