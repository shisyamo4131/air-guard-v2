<script setup>
/**
 * @file pages/employees/terminated.vue
 * @description Terminated employees management page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useEmployeesManager } from "@/composables/useEmployeesManager";

/** SETUP */
const search = ref(null);
const options = [
  ["where", "employmentStatus", "==", Employee.STATUS_TERMINATED],
];

const { docs } = useDocuments("Employee", {
  search,
  options: toRef(options),
});
const { attrs } = useEmployeesManager({ docs, useDelay: 500 });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager
      class="fill-height"
      v-bind="attrs"
      :table-props="{ hideAction: true }"
      @update:search="search = $event"
    >
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
