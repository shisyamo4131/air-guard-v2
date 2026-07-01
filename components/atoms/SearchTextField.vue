<script setup>
/*****************************************************************************
 * @file ./components/Atoms/SearchTextField.vue
 * @description 検索文字列入力用テキストフィールドコンポーネント
 *****************************************************************************/
</script>

<template>
  <air-text-field
    density="compact"
    clearable
    prepend-inner-icon="mdi-magnify"
    variant="solo"
    flat
    label="SEARCH"
    hide-details
    single-line
  />
</template>
