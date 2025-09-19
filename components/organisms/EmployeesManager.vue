<script setup>
/**
 * @file compoenents/organisms/EmployeesManager.vue
 * @description A component to manage employees.
 */
import { Employee } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("EmployeesManager", useErrorsStore());
const { add, remove } = useLoadingsStore();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new Employee());
const docs = ref([]);
const search = ref("");
const onlyActive = ref(true); // Whether to show only active employees.

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(search, fetchDocs, { immediate: true });

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function fetchDocs() {
  const key = add("Fetching employees...");
  try {
    const constraints = search.value
      ? search.value
      : [["where", "employmentStatus", "==", Employee.STATUS_ACTIVE]];

    docs.value = await model.fetchDocs({ constraints });
  } catch (error) {
    error({ error, message: "Failed to fetch employees." });
  } finally {
    remove(key);
  }
}

function customFilter(value, query, item) {
  return (
    !onlyActive.value ||
    item.columns.employmentStatus === Employee.STATUS_ACTIVE
  );
}
</script>

<template>
  <air-array-manager
    v-model="docs"
    :schema="Employee"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    v-model:search="search"
    :delay="300"
    :table-props="{
      customFilter,
      sortBy: [{ key: 'code', order: 'desc' }],
    }"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
