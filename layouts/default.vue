<script setup>
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/useAppStore";

/** SETUP STORES */
const appStore = useAppStore();
const messages = useMessagesStore();
const { queue } = useLoadingsStore();

// ルーターと認証ストアの取得
const router = useRouter();
const auth = useAuthStore();

/**
 * サインアウト処理
 * Handle user sign-out and redirect to top page
 */
const handleSignOut = async () => {
  try {
    await auth.signOut();
    await router.push("/");
  } catch (error) {
    console.error("Failed to sign out:", error);
  }
};
</script>

<template>
  <v-app>
    <!-- グローバルローディング状態を表示するダイアログ -->
    <air-loading-dialog :model-value="queue" />

    <!-- SNACKBAR FOR GLOBAL MESSAGE -->
    <v-snackbar-queue v-model="messages.queue" />

    <!-- アプリケーション上部のツールバー -->
    <v-app-bar v-bind="appStore.appBar">
      <template #prepend>
        <v-app-bar-nav-icon v-bind="appStore.navIcon" />
        <v-btn v-bind="appStore.previousButton" />
      </template>
    </v-app-bar>

    <AppNavigationDrawer v-bind="appStore.navBar">
      <template #append>
        <v-list-item
          title="Sign Out"
          @click="handleSignOut"
          prepend-icon="mdi-logout"
          class="text-error"
        />
      </template>
    </AppNavigationDrawer>

    <!-- メインコンテンツ表示領域 -->
    <v-main scrollable>
      <NuxtPage
        :keepalive="{
          include: ['billings-customers'],
          max: 10,
        }"
      />
    </v-main>

    <!-- フッター -->
    <v-footer app color="grey-darken-4" class="white--text text-center">
      <span class="mx-auto">
        &copy; {{ new Date().getFullYear() }} AirGuard
      </span>
    </v-footer>
  </v-app>
</template>

<style>
.firebase-emulator-warning {
  display: none;
}

/* CSS カスタムプロパティの定義 */
:root {
  --app-bar-height: 64px; /* VAppBar の高さ */
  --footer-height: 40px; /* VFooter の高さ */
}
</style>
