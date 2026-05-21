<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Workers/DataTable/index.vue
 * @description A data table component to manage `OperationResultWorkers`.
 *****************************************************************************/
// COMPOSABLES
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationResultWorkersDataTable", inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchEmployeeComposable } = useFetch("OperationResultWorkersDataTable");
const { cachedEmployees } = fetchEmployeeComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const headers = computed(() => {
  return [
    { title: "名前", key: "displayName" },
    { title: "開始", key: "startTime" },
    { title: "終了", key: "endTime" },
    { title: "休憩", key: "breakMinutes" },
    { title: "残業", key: "overtimeWorkMinutes" },
    { title: "OJT", key: "isOjt" },
  ];
});
</script>

<template>
  <air-data-table v-bind="$attrs" :headers="headers">
    <!-- 作業員名 -->
    <template #[`item.displayName`]="{ item }">
      <AtomsIconsHasLicense v-if="item.isQualified" />
      {{ cachedEmployees[item.employeeId]?.displayName ?? "N/A" }}
    </template>

    <!-- OJT -->
    <template #[`item.isOjt`]="{ item }">
      <v-icon
        :icon="`${item.isOjt ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'}`"
      />
    </template>
  </air-data-table>
</template>
