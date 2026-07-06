<script setup>
/*****************************************************************************
 * @file ./components/SiteEmployeeHistory/Employee/Chip.vue
 * @description 現場入場履歴従業員チップコンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SiteEmployeeHistoryEmployeeChip", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  history: { type: Object, required: true },
  location: { type: String, default: "top" },
});
const props = useDefaults(_props, "SiteEmployeeHistoryEmployeeChip");

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchEmployeeComposable } = useFetch("SiteEmployeeHistoryEmployeeChip");
const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const text = computed(() => {
  const cachedEmployee = cachedEmployees.value[props.history.employeeId];
  return cachedEmployee?.displayName || "...loading";
});

const tooltipText = computed(() => {
  const firstLine = `初回: ${props.history.firstDate}`;
  const secondLine = `最終: ${props.history.lastDate}`;
  return `${firstLine}\n${secondLine}`;
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(() => props.history.employeeId, fetchEmployee, { immediate: true });
</script>

<template>
  <v-tooltip :open-on-hover="false" :location="props.location" open-on-click>
    <template #activator="{ props }">
      <v-chip v-bind="{ ...$attrs, ...props }" :text="text" />
    </template>
    <span style="white-space: pre-line">
      {{ tooltipText }}
    </span>
  </v-tooltip>
</template>
