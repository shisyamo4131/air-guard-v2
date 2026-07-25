<script setup>
/*****************************************************************************
 * @file ./pages/attendances/index.vue
 * @description 従業員別勤怠情報ページ
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "attendances-index" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("daily-attendance-index", true);
</script>

<template>
  <v-container
    class="align-start pa-0"
    style="height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <DailyAttendanceIndex class="fill-height" />
  </v-container>
</template>
