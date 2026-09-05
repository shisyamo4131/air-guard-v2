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
const { canWrite, isSaving } = useSiteActions();
</script>

<template>
  <v-container class="fill-height align-start">
    <SitesManager
      class="fill-height"
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
      :handle-click-update="(item) => router.push(`/sites/${item.docId}`)"
      :table-props="{
        customFilter: () => true,
        disableCreate: !canWrite || isSaving,
        editIcon: canWrite ? 'mdi-pencil' : 'mdi-eye',
      }"
    />
  </v-container>
</template>
