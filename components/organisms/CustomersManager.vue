<script setup>
/**
 * @file components/organisms/CustomersManager.vue
 * @description A component to manage customers.
 */
import { Customer } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("CustomersManager", useErrorsStore());

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new Customer());
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
    :schema="Customer"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
