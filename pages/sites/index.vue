<script setup>
/**
 * @file pages/settings/sites.vue
 * @description 現場管理画面
 */
</script>

<template>
  <v-container>
    <OrganismsSitesManager
      :before-edit="
        (editMode, item) => {
          if (editMode === 'CREATE') return true;
          $router.push(`sites/${item.docId}`);
          return false;
        }
      "
    />
  </v-container>
</template>
