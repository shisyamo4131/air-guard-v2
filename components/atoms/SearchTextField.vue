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
    placeholder="Search"
    prepend-inner-icon="mdi-magnify"
    variant="solo"
    flat
    hide-details
    single-line
  />
</template>
