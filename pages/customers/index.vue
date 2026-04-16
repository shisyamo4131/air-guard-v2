<script setup>
/*****************************************************************************
 * @file pages/customers/index.vue
 * @description 取引先情報一覧ページ
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useRouter } from "vue-router";

defineOptions({ name: "customers-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");
const defaultOption = ref([
  ["where", "contractStatus", "==", Customer.STATUS_ACTIVE],
]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const { docs } = useDocuments("Customer", {
  search,
  options: defaultOption,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <CustomersManager
      :docs="docs"
      v-model:search="search"
      :items-per-page="-1"
      :sort-by="[{ key: 'code', order: 'asc' }]"
    />
  </TemplatesFixedHeightContainer>
</template>
