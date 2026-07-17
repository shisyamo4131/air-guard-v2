<script setup>
/*****************************************************************************
 * @file pages/billings/customers/index.vue
 * @description 取引先請求一覧ページ
 *****************************************************************************/
defineOptions({ name: "billings-customers-index" });
</script>

<template>
  <v-container
    class="align-start"
    style="height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <CustomerBillingsManager class="fill-height" />
  </v-container>
</template>
