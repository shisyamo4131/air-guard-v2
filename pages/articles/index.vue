<script setup>
/*****************************************************************************
 * @file pages/articles/index.vue
 * @description 商品一覧ページ
 *****************************************************************************/
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "articles-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const options = computed(() => {
  if (!search.value) {
    return [
      ["orderBy", "updatedAt", "desc"],
      ["limit", 10],
    ];
  } else {
    return [["orderBy", "code", "asc"]];
  }
});

const { docs } = useDocuments("Article", {
  search,
  options,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <v-container class="fill-height align-start">
    <ArticlesManager
      class="fill-height"
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
    />
  </v-container>
</template>
