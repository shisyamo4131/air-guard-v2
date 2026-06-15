<script setup>
/*****************************************************************************
 * @file pages/arrangements-manager.vue
 * @description 配置管理ページ
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "arrangements-manager" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("arrangements-manager", true);
</script>

<template>
  <ArrangementsManager />
</template>
