<script setup>
/**
 * @file ./pages/collection-route/index.vue
 * @description ルート管理画面
 */
</script>

<template>
  <v-container>
    <OrganismsCollectionRoutesManager
      :before-edit="
        (editMode, item) => {
          if (editMode === 'CREATE') return true;
          $router.push(`collection-routes/${item.docId}`);
          return false;
        }
      "
    />
  </v-container>
</template>
