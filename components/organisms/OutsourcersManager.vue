<script setup>
/**
 * @file components/organisms/OutsourcersManager.vue
 * @description A component to manage outsourcers.
 */
import { Outsourcer } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("EmployeesManager", useErrorsStore());

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new Outsourcer());
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
    :schema="Outsourcer"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
