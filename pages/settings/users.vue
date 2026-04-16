<script setup>
/*****************************************************************************
 * @file pages/settings/users/index.vue
 * @description 在職従業員一覧ページ
 *****************************************************************************/
import { useDocuments } from "@/composables/dataLayers/useDocuments";

defineOptions({ name: "users-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const options = computed(() => {
  if (!search.value) {
    return [["orderBy", "email"]];
  } else {
    return [["orderBy", "email"]];
  }
});
const { docs } = useDocuments("User", {
  search,
  options,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <UsersManager class="fill-height" :docs="docs" />
  </TemplatesFixedHeightContainer>
</template>
