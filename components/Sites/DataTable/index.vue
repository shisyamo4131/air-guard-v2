<script setup>
/*****************************************************************************
 * @file ./components/Sites/DataTable/index.vue
 * @description A data table component of `Sites`.
 *****************************************************************************/
const headers = computed(() => {
  return [
    { title: "現場コード", key: "code" },
    { title: "現場名", key: "name" },
  ];
});
</script>

<template>
  <v-data-table :headers="headers" />
</template>
