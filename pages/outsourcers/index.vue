<script setup>
/*****************************************************************************
 * @file pages/outsourcers/index.vue
 * @description 外注先情報一覧ページ
 *****************************************************************************/
import { useOutsourcerListPagination } from "@/composables/dataLayers/outsourcer/useOutsourcerListPagination";

defineOptions({ name: "outsourcers-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const {
  currentPage,
  errorMessage,
  hasNextPage,
  hasPreviousPage,
  items,
  loaded,
  loading,
  loadNext,
  loadPrevious,
  reload,
  restart,
} = useOutsourcerListPagination({
  search,
});
</script>

<template>
  <v-container class="fill-height align-start">
    <OutsourcersManager
      class="fill-height"
      :docs="items"
      v-model:search="search"
      :items-per-page="20"
      hide-default-footer
      show-pagination
      :current-page="currentPage"
      :loading="loading"
      :loaded="loaded"
      :error-message="errorMessage"
      :has-next-page="hasNextPage"
      :has-previous-page="hasPreviousPage"
      @create="restart"
      @update="restart"
      @load:next="loadNext"
      @load:previous="loadPrevious"
      @retry="reload"
    />
  </v-container>
</template>
