<script setup>
/*****************************************************************************
 * @file ./components/Worker/Chip.vue
 * @description A chip component for displaying `displayName` of `Worker`.
 * @extends VChip
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";
import { employeeReadLabel } from "@/composables/domain/employee/employeeReadLabel";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  worker: { type: Object, required: true },
});
const props = useDefaults(_props, "WorkerChip");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchEmployeeComposable, fetchOutsourcerComposable } =
  useFetch("WorkerChip");

const { cachedEmployees, fetchEmployee } = fetchEmployeeComposable;
const { cachedOutsourcers, fetchOutsourcer } = fetchOutsourcerComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => [props.worker, fetchEmployeeComposable.scope?.value],
  ([newWorker]) => {
    if (!newWorker || !newWorker.id) return;
    const fetchFn = newWorker.isEmployee ? fetchEmployee : fetchOutsourcer;
    fetchFn(newWorker.id);
  },
  { immediate: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const cachedData = computed(() => {
  if (!props.worker) return null;
  return props.worker.isEmployee
    ? cachedEmployees.value
    : cachedOutsourcers.value;
});

const displayName = computed(() => {
  if (!props.worker) return "N/A";
  if (props.worker.isEmployee) return employeeReadLabel(fetchEmployeeComposable.getStatus(props.worker.id), cachedEmployees.value[props.worker.id]?.displayName);
  return cachedData?.value?.[props.worker.id]?.displayName || "N/A";
});
</script>

<template>
  <v-chip :text="displayName" />
</template>
