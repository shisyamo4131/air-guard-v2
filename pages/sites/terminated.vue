<script setup>
/*****************************************************************************
 * @file pages/sites/terminated.vue
 * @description 終了現場検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { Site } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "sites-terminated-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();

const defaultOption = ["where", "status", "==", Site.STATUS_TERMINATED];
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
});
</script>

<template>
  <v-container class="fill-height align-start">
    <SitesManager
      class="fill-height"
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
      @click:detail="(item) => router.push(`/sites/${item.docId}`)"
    />
  </v-container>
</template>
