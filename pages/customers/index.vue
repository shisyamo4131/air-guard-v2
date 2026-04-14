<script setup>
/*****************************************************************************
 * @file pages/customers/index.vue
 * @description 取引先情報一覧ページ
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "customers-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const defaultOption = ["where", "contractStatus", "==", Customer.STATUS_ACTIVE];
const options = computed(() => {
  if (!search.value) {
    return [defaultOption, ["orderBy", "updatedAt", "desc"], ["limit", 10]];
  } else {
    return [defaultOption, ["orderBy", "code", "desc"]];
  }
});

const { docs } = useDocuments("Customer", {
  search,
  options,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <CustomersManager
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
    />
  </TemplatesFixedHeightContainer>
</template>
