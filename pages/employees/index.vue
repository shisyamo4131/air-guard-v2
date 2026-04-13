<script setup>
/*****************************************************************************
 * @file pages/employees/index.vue
 * @description 在職従業員一覧ページ
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
  Employee.STATUS_ACTIVE,
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
