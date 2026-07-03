<script setup>
/*****************************************************************************
 * @file pages/operation-schedules/index.vue
 * @description 配置管理ページ
 * - スクロール制御を `OperationSchedulesManager` に移譲するため、ルート要素の高さを固定
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";

defineOptions({ name: "operation-schedules-index" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("operation-schedules-index", true);
</script>

<template>
  <div
    style="height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <OperationSchedulesManager />
  </div>
</template>
