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

function handleBeforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return true;
  router.push(`/employees/${item.docId}`);
  return false;
}
</script>

<template>
  <AppViewportContainer>
    <EmployeesManager :before-edit="handleBeforeEdit" :model-value="docs">
      <template #table="{ items, toUpdate }">
        <div class="d-flex flex-column flex-grow-1 overflow-hidden">
          <AppMasterListToolbar
            :search="search"
            :search-delay="300"
            @update:search="search = $event"
          />
          <v-progress-linear v-if="loading" indeterminate />
          <v-alert v-else-if="error" type="error">
            {{ error }}
            <template #append>
              <v-btn text="再読込" @click="reload" />
            </template>
          </v-alert>
          <EmployeesIterator
            class="flex-grow-1"
            grid
            :employees="items"
            :items-per-page="20"
            show-detail
            @click:detail="toUpdate"
          />
        </div>
      </template>
    </EmployeesManager>
  </AppViewportContainer>
</template>
