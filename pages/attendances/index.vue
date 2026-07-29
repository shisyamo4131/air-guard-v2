<script setup>
/*****************************************************************************
 * @file ./pages/attendances/index.vue
 * @description 従業員別勤怠情報ページ
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";
import { useCompanyStore } from "@/stores/useCompanyStore";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "attendances-index" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("daily-attendance-index", true);
const companyStore = useCompanyStore();
</script>

<template>
  <v-container
    class="align-start pa-0"
    style="height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom))"
    fluid
  >
    <DailyAttendanceIndex
      :key="companyStore.company.attendanceManagementMode"
      class="fill-height"
      :attendance-management-mode="
        companyStore.company.attendanceManagementMode
      "
    />
  </v-container>
</template>
