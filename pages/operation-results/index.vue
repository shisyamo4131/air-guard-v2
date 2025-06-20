<script setup>
/**
 * @file pages/settings/operation-results.vue
 * @description 稼働実績管理画面
 */
</script>

<template>
  <v-container>
    <OrganismsOperationResultsManager
      :before-edit="
        (editMode, item) => {
          if (editMode === 'CREATE') return true;
          $router.push(`operation-results/${item.docId}`);
          return false;
        }
      "
    />
  </v-container>
</template>
