<script setup>
/*****************************************************************************
 * @file pages/employees/resigned.vue
 * @description 退職従業員検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "employees-resigned-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();

const defaultOption = [
  "where",
  "employmentStatus",
  "==",
  Employee.STATUS_RESIGNED,
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
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <EmployeesManager
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
      @click:detail="(item) => router.push(`/employees/${item.docId}`)"
    />
  </TemplatesFixedHeightContainer>
</template>
