<script setup>
/**
 * @file pages/employees/index.vue
 * @description Active employee list page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const options = [["where", "employmentStatus", "==", Employee.STATUS_ACTIVE]];
const { docs } = useDocuments("Employee", {
  search,
  options: toRef(options),
  fetchAllOnEmpty: true,
});
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
