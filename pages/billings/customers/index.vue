<script setup>
/*****************************************************************************
 * @file pages/billings/customers/index.vue
 * @description 取引先請求一覧ページ
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "billings-customers-index" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("billings-customers-index", true);
</script>

<template>
  <v-container
    class="align-start"
    style="height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <CustomerBillingsManager class="fill-height" />
  </v-container>
</template>
