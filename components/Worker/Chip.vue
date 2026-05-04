<script setup>
/*****************************************************************************
 * @file ./components/Worker/Chip.vue
 * @description A chip component for displaying `displayName` of `Worker`.
 * @extends VChip
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

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
  () => props.worker,
  (newWorker) => {
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
  return cachedData?.value?.[props.worker.id]?.displayName || "N/A";
});
</script>

<template>
  <v-chip :text="displayName" />
</template>
