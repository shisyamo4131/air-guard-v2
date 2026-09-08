<script setup>
/*****************************************************************************
 * @file pages/employees/resigned.vue
 * @description 退職従業員検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { Employee } from "@/schemas";
import { useEmployeeList } from "@/composables/application/employee/useEmployeeList";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref(null);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { docs, loading, error, reload } = useEmployeeList({
  status: Employee.STATUS_RESIGNED,
  search,
  recentField: "dateOfTermination",
});
</script>

<template>
  <AppViewportContainer>
    <EmployeesManager
      class="fill-height"
      :docs="docs"
      :loading="loading"
      :error="error"
      v-model:search="search"
      :items-per-page="20"
      @click:detail="(item) => router.push(`/employees/${item.docId}`)"
      @reload="reload"
    />
  </AppViewportContainer>
</template>
