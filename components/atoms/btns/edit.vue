<script setup>
/**
 * @file AtomsBtnsEdit.vue
 * @description 固定デザインの編集ボタンコンポーネントです。
 *  `mdi-pencil` アイコンと `編集` テキストが表示されます。
 */
defineOptions({ inheritAttrs: false, name: "AtomsBtnsEdit" });
</script>

<template>
  <v-btn v-bind="$attrs" prepend-icon="mdi-pencil"> 編集 </v-btn>
</template>
