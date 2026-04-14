<script setup>
/*****************************************************************************
 * @file pages/outsourcers/index.vue
 * @description 外注先情報一覧ページ
 *****************************************************************************/
import { Outsourcer } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "outsourcers-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const defaultOption = [
  "where",
  "contractStatus",
  "==",
  Outsourcer.STATUS_ACTIVE,
];
const options = computed(() => {
  if (!search.value) {
    return [defaultOption, ["orderBy", "updatedAt", "desc"], ["limit", 10]];
  } else {
    return [defaultOption, ["orderBy", "code", "desc"]];
  }
});

const { docs } = useDocuments("Outsourcer", {
  search,
  options,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <OutsourcersManager
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
    />
  </TemplatesFixedHeightContainer>
</template>
