<script setup>
/**
 * @file components/organisms/EmployeesManager.vue
 * @description A component to manage employees.
 * - This component is for managing employees whom employment status is active.
 */
import { Employee } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("EmployeesManager", useErrorsStore());

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new Employee());
const search = ref("");
const loading = ref(false);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(search, subscribeDocs, { immediate: true });

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribeDocs() {
  try {
    loading.value = true;
    const statusOption = [
      "where",
      "employmentStatus",
      "==",
      Employee.STATUS_ACTIVE,
    ];
    const constraints = search.value ? search.value : [statusOption];
    const options = search.value ? [statusOption] : [];
    model.subscribeDocs({ constraints, options });
  } catch (error) {
    error({ error, message: "Failed to fetch employees." });
  } finally {
    loading.value = false;
  }
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <air-array-manager
    v-model="model.docs"
    :schema="Employee"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    v-model:search="search"
    :delay="300"
    :loading="loading"
    :table-props="{
      customFilter: () => true,
      sortBy: [{ key: 'code', order: 'desc' }],
    }"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
