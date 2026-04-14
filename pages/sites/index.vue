<script setup>
/*****************************************************************************
 * @file pages/sites/index.vue
 * @description 現場情報一覧ページ
 *****************************************************************************/
import { Site } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "sites-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const defaultOption = ["where", "status", "==", Site.STATUS_ACTIVE];
const options = computed(() => {
  if (!search.value) {
    return [defaultOption, ["orderBy", "updatedAt", "desc"], ["limit", 10]];
  } else {
    return [defaultOption, ["orderBy", "code", "desc"]];
  }
});

const { docs } = useDocuments("Site", {
  search,
  options,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <SitesManager :docs="docs" v-model:search="search" :items-per-page="20" />
  </TemplatesFixedHeightContainer>
</template>
