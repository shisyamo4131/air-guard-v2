<script setup>
/**
 * @file compoenents/organisms/EmployeesManager.vue
 * @description A component to manage employees.
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
const docs = ref([]);

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  docs.value = model.subscribeDocs();
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <air-array-manager
    v-model="docs"
    :schema="Employee"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
