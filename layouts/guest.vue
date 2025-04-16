<script setup></script>

<template>
  <v-app>
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
