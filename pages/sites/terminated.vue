<script setup>
/*****************************************************************************
 * @file pages/sites/terminated.vue
 * @description 終了現場検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { PAGE_SIZE, useSiteUiReads } from "@/composables/dataLayers/site/useSiteUiReads";
import { useSiteActions } from "@/composables/application/site/useSiteActions";

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
const { errorMessage, isEmpty, isLoading, searchTerminatedSites } = useSiteUiReads();
const { canWrite } = useSiteActions();

watch(search, async (value) => {
  page.value = 1;
  try {
    docs.value = await searchTerminatedSites(value);
  } catch {
    docs.value = [];
  }
}, { immediate: true });
</script>

<template>
  <v-container
    class="align-start"
    style="height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <v-card class="fill-height d-flex flex-column" width="100%">
      <v-toolbar class="mb-4 bg-transparent" density="compact">
        <AtomsSearchTextField v-model="search" />
      </v-toolbar>
      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mx-4 mb-3">
        {{ errorMessage }}
      </v-alert>
      <v-alert v-else-if="search && isEmpty && !isLoading" type="info" variant="tonal" class="mx-4 mb-3">
        該当する終了済み現場はありません。
      </v-alert>
      <SitesDataTable
        v-model:page="page"
        class="flex-grow-1 overflow-hidden"
        :items="docs"
        :search="search"
        :custom-filter="() => true"
        :sort-by="[]"
        :items-per-page="PAGE_SIZE"
        :loading="isLoading"
        :edit-icon="canWrite ? 'mdi-pencil' : 'mdi-eye'"
        @click:update="(item) => router.push(`/sites/${item.docId}`)"
      />
    </v-card>
  </v-container>
</template>
