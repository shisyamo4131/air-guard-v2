<script setup>
/*****************************************************************************
 * @file pages/sites/terminated.vue
 * @description 終了現場検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { useSitesTerminated } from "@/composables/dataLayers/site/useSitesTerminated";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref(null);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { docs } = useSitesTerminated({ search });
</script>

<template>
  <v-container class="fill-height align-start">
    <SitesManager
      class="fill-height"
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
      :table-props="{
        customFilter: () => true,
      }"
      @click:detail="(item) => router.push(`/sites/${item.docId}`)"
    />
  </v-container>
</template>
