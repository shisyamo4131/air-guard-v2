<script setup>
/**
 * @file pages/employees/index.vue
 * @description Active employee list page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

/** SETUP */
const options = [["where", "employmentStatus", "==", Employee.STATUS_ACTIVE]];
const { docs } = useDocuments("Employee", {
  options: toRef(options),
  fetchAllOnEmpty: true,
});

const search = ref("");
</script>

<template>
  <TemplatesFixedHeightContainer>
    <EmployeesManager
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
    />
  </TemplatesFixedHeightContainer>
</template>
