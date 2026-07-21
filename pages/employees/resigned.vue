<script setup>
/*****************************************************************************
 * @file pages/employees/resigned.vue
 * @description 退職従業員検索ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { useEmployeesResigned } from "@/composables/dataLayers/employee/useEmployeesResigned";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref(null);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const { docs } = useEmployeesResigned({ search });
</script>

<template>
  <v-container
    style="height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <EmployeesManager
      class="fill-height"
      :docs="docs"
      v-model:search="search"
      :items-per-page="20"
      @click:detail="(item) => router.push(`/employees/${item.docId}`)"
    />
  </v-container>
</template>
