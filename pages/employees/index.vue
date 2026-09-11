<script setup>
/*****************************************************************************
 * @file pages/employees/index.vue
 * @description 在職従業員一覧ページ
 *****************************************************************************/
import { Employee } from "@/schemas";
import { useEmployeeList } from "@/composables/application/employee/useEmployeeList";
import { useRouter } from "vue-router";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
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
});

function handleBeforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return true;
  router.push(`/employees/${item.docId}`);
  return false;
}

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <AppViewportContainer>
    <EmployeesManager
      :before-edit="handleBeforeEdit"
      :model-value="docs"
      @create="(item) => router.push(`/employees/${item.docId}`)"
    >
      <template #table="{ items, toCreate, toUpdate }">
        <div class="d-flex flex-column flex-grow-1 overflow-hidden">
          <AppMasterListToolbar
            :search="search"
            :search-delay="300"
            @update:search="search = $event"
          >
            <template #append>
              <v-btn
                icon="mdi-plus"
                aria-label="従業員を登録"
                title="従業員を登録"
                @click="() => toCreate()"
              />
            </template>
          </AppMasterListToolbar>
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
            hide-default-footer
            :items-per-page="-1"
            show-detail
            :sort-by="[]"
            @click:detail="toUpdate"
          />
        </div>
      </template>
    </EmployeesManager>
  </AppViewportContainer>
</template>
