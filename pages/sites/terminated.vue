<script setup>
/*****************************************************************************
 * @file pages/sites/terminated.vue
 * @description 終了現場検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import {
  PAGE_SIZE,
  useSiteUiReads,
} from "@/composables/dataLayers/site/useSiteUiReads";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref(null);
const page = ref(1);
const docs = ref([]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { errorMessage, isEmpty, isLoading, searchTerminatedSites } =
  useSiteUiReads();

watch(
  search,
  async (value) => {
    page.value = 1;
    try {
      docs.value = await searchTerminatedSites(value);
    } catch {
      docs.value = [];
    }
  },
  { immediate: true },
);
</script>

<template>
  <AppViewportContainer>
    <v-card class="fill-height d-flex flex-column" width="100%">
      <AppMasterListToolbar v-model:search="search" :search-delay="300" />
      <v-alert
        v-if="errorMessage"
        type="error"
        variant="tonal"
        class="mx-4 mb-3"
      >
        {{ errorMessage }}
      </v-alert>
      <v-alert
        v-else-if="isEmpty && !isLoading"
        type="info"
        variant="tonal"
        class="mx-4 mb-3"
      >
        {{ search ? "該当する終了済み現場はありません。" : "終了済み現場はありません。" }}
      </v-alert>
      <SitesDataTable
        v-model:page="page"
        class="flex-grow-1 overflow-hidden"
        :items="docs"
        :sort-by="[]"
        :items-per-page="PAGE_SIZE"
        :loading="isLoading"
        edit-icon="mdi-pencil"
        @click:update="(item) => router.push(`/sites/${item.docId}`)"
      />
    </v-card>
  </AppViewportContainer>
</template>
