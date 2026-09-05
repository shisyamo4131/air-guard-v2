<script setup>
/*****************************************************************************
 * @file pages/sites/terminated.vue
 * @description 終了現場検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { useSitesTerminated } from "@/composables/dataLayers/site/useSitesTerminated";
import { useSiteActions } from "@/composables/application/site/useSiteActions";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref(null);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { docs } = useSitesTerminated({ search });
const { canWrite } = useSiteActions();
</script>

<template>
  <v-container class="fill-height align-start">
    <v-card class="fill-height d-flex flex-column" width="100%">
      <v-toolbar class="mb-4 bg-transparent" density="compact">
        <AtomsSearchTextField v-model="search" />
      </v-toolbar>
      <SitesDataTable
        class="flex-grow-1 overflow-hidden"
        :items="docs"
        :search="search"
        :custom-filter="() => true"
        :items-per-page="20"
        :edit-icon="canWrite ? 'mdi-pencil' : 'mdi-eye'"
        @click:update="(item) => router.push(`/sites/${item.docId}`)"
      />
    </v-card>
  </v-container>
</template>
