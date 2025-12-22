<script setup>
/**
 * @file pages/employees/terminated.vue
 * @description Terminated employees management page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useEmployeesManager } from "@/composables/useEmployeesManager";

/** SETUP */
const search = ref("");
const subscribeOptions = computed(() => ({
  constraints: search.value,
  options: [["where", "employmentStatus", "==", Employee.STATUS_TERMINATED]],
}));

const { docs } = useDocuments("Employee", subscribeOptions);
const { attrs } = useEmployeesManager({ docs, useDelay: 300 });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager
      class="fill-height"
      v-bind="attrs"
      :search="search"
      :table-props="{ hideAction: true }"
      @update:search="search = $event"
    >
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
