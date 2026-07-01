<script setup>
/*****************************************************************************
 * @file pages/customers/index.vue
 * @description 取引先情報一覧ページ
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useRouter } from "vue-router";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "customers-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");
const defaultOption = ref([
  ["where", "contractStatus", "==", Customer.STATUS_ACTIVE],
]);

/*****************************************************************************
 * SETUP ROUTER COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const { docs } = useDocuments("Customer", {
  search,
  options: defaultOption,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <v-container class="fill-height align-start">
    <CustomersManager class="fill-height" :docs="docs">
      <template #table="slotProps">
        <v-toolbar class="mb-4 bg-transparent" density="compact">
          <AtomsSearchTextField v-model="search" />
          <v-btn icon="mdi-plus" @click="() => slotProps.toCreate()" />
        </v-toolbar>
        <CustomersDataTable
          class="flex-grow-1"
          v-bind="slotProps"
          hide-search
          :search="search"
        />
      </template>
    </CustomersManager>
  </v-container>
</template>
