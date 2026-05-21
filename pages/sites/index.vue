<script setup>
/*****************************************************************************
 * @file pages/sites/index.vue
 * @description 稼働中現場情報一覧ページ
 *****************************************************************************/
import { Site } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useRouter } from "vue-router";

defineOptions({ name: "sites-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");
const defaultOption = ref([["where", "status", "==", Site.STATUS_ACTIVE]]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { docs } = useDocuments("Site", {
  search,
  options: defaultOption,
  fetchAllOnEmpty: true,
});

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <v-container class="fill-height align-start">
    <SitesManager
      class="fill-height"
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
      @create="(item) => router.push(`/sites/${item.docId}`)"
      @click:detail="(item) => router.push(`/sites/${item.docId}`)"
    />
  </v-container>
</template>
