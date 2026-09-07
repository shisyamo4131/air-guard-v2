<script setup>
/*****************************************************************************
 * @file pages/employees/index.vue
 * @description 在職従業員一覧ページ
 *****************************************************************************/
import { Employee } from "@/schemas";
import { useEmployeeList } from "@/composables/application/employee/useEmployeeList";
import { useRouter } from "vue-router";

defineOptions({ name: "employees-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { docs, loading, error, reload } = useEmployeeList({
  status: Employee.STATUS_ACTIVE,
  search,
  fetchAllOnEmpty: true,
});

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <AppViewportContainer>
    <EmployeesManager
      class="fill-height"
      :docs="docs"
      :loading="loading"
      :error="error"
      show-create
      v-model:search="search"
      :items-per-page="-1"
      :sort-by="[{ key: 'fullNameKana', order: 'asc' }]"
      @create="(item) => router.push(`/employees/${item.docId}`)"
      @click:detail="(item) => router.push(`/employees/${item.docId}`)"
      @reload="reload"
    />
  </AppViewportContainer>
</template>
