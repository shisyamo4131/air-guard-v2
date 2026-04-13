<script setup>
/*****************************************************************************
 * @file pages/employees/terminated.vue
 * @description 退職従業員検索ページ
 *****************************************************************************/
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const defaultOption = [
  "where",
  "employmentStatus",
  "==",
  Employee.STATUS_TERMINATED,
];
const options = computed(() => {
  if (!search.value) {
    return [defaultOption, ["orderBy", "updatedAt", "desc"], ["limit", 10]];
  } else {
    return [defaultOption, ["orderBy", "code", "desc"]];
  }
});
const { docs } = useDocuments("Employee", {
  search,
  options,
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
