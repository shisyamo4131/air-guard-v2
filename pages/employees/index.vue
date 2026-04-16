<script setup>
/*****************************************************************************
 * @file pages/employees/index.vue
 * @description 在職従業員一覧ページ
 *****************************************************************************/
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useRouter } from "vue-router";

defineOptions({ name: "employees-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");
const defaultOption = ref([
  ["where", "employmentStatus", "==", Employee.STATUS_ACTIVE],
]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const { docs } = useDocuments("Employee", {
  search,
  options: defaultOption,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <EmployeesManager
      :docs="docs"
      v-model:search="search"
      :items-per-page="-1"
      :sort-by="[{ key: 'code', order: 'asc' }]"
      @create="(item) => router.push(`/employees/${item.docId}`)"
    />
  </TemplatesFixedHeightContainer>
</template>
