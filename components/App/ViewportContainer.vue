<script setup>
/*****************************************************************************
 * @file components/App/ViewportContainer.vue
 * @description Vuetify の application layout 内で表示領域の高さを揃えるコンテナ
 *****************************************************************************/
defineOptions({
  name: "AppViewportContainer",
  inheritAttrs: false,
});
</script>

<template>
  <v-container
    v-bind="$attrs"
    class="app-viewport-container align-start"
  >
    <slot />
  </v-container>
</template>

<style scoped>
.app-viewport-container {
  height: calc(
    100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px)
  );
  min-height: 0;
}
</style>
