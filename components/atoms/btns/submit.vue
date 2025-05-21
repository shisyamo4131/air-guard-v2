<script setup>
/**
 * @file AtomsBtnsSubmit.vue
 * @description
 * 固定デザインの「確定」ボタンコンポーネントです。
 * 「mdi-check」アイコンと「確定」テキストが表示されます。
 */
defineOptions({ inheritAttrs: false, name: "AtomsBtnsSubmit" });
</script>

<template>
  <v-btn v-bind="$attrs" prepend-icon="mdi-check"> 確定 </v-btn>
</template>
