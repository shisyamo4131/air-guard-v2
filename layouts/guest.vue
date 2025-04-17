<script setup>
// ローディングキュー
const { queue } = useLoadingsStore();
</script>

<template>
  <v-app>
    <!-- グローバルローディング状態を表示するダイアログ -->
    <air-loading-dialog :model-value="queue" />

    <!-- アプリケーション上部のツールバー -->
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>AirGuard</v-app-bar-title>
    </v-app-bar>

    <!-- メインコンテンツ表示領域 -->
    <v-main>
      <NuxtPage />
    </v-main>

    <!-- フッター -->
    <v-footer app color="grey-darken-4" class="white--text text-center">
      <span class="mx-auto">
        &copy; {{ new Date().getFullYear() }} AirGuard
      </span>
    </v-footer>
  </v-app>
</template>
