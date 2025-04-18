<script setup>
// Vuetify のレスポンシブ情報取得用ユーティリティ
import { useDisplay } from "vuetify";

// サインアウト処理に使用する認証ストア
import { useAuthStore } from "@/stores/useAuthStore";

// メッセージストアとローディングキュー
const messages = useMessagesStore();
const { queue } = useLoadingsStore();

// ナビゲーションドロワーの開閉状態
const drawer = ref(false);

// 画面幅が lg 以上かどうかを判定（ドロワーの常時表示に使用）
const { lgAndUp } = useDisplay();

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

    <v-snackbar-queue v-model="messages.queue"></v-snackbar-queue>

    <!-- アプリケーション上部のツールバー -->
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>AirGuard</v-app-bar-title>
    </v-app-bar>

    <AppNavigationDrawer
      v-model="drawer"
      :permanent="lgAndUp"
      :temporary="!lgAndUp"
      app
    >
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

<style>
.firebase-emulator-warning {
  display: none;
}
</style>
