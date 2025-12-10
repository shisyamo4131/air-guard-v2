<script setup>
defineProps({
  color: { type: String, default: "primary" },
  titleClass: { type: String, default: "" },
});
</script>

<template>
  <div class="position-relative pt-3">
    <!-- はみ出すタイトル部分 -->
    <v-card
      :color="color"
      class="position-absolute"
      :class="titleClass"
      :border="false"
      style="top: 0; left: 12px; z-index: 2; max-width: 80%"
    >
      <v-card-title class="text-subtitle-1">
        <slot name="title" />
      </v-card-title>
    </v-card>

    <!-- カード本体 -->
    <v-card class="position-relative pt-10">
      <v-card-text class="pt-2">
        <slot name="default" />
      </v-card-text>

      <!-- その他のスロット -->
      <template v-for="(_, name) in $slots" :key="name">
        <template v-if="name !== 'default' && name !== 'title'">
          <slot :name="name" />
        </template>
      </template>
    </v-card>
  </div>
</template>

<style scoped>
/* 残りのスタイル（Vuetifyクラスで代替できないもの） */
</style>
