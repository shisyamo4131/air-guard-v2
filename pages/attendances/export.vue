<script setup>
/*****************************************************************************
 * @file pages/attendances/export.vue
 * @description 打刻データエクスポートページ
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "attendances-export" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("attendances-export", true);
</script>

<template>
  <v-container class="fill-height align-start">
    <DailyAttendanceExporter class="w-100" />
  </v-container>
</template>
