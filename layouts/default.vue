<script setup>
// Vuetify のレスポンシブ情報取得用ユーティリティ
import { useDisplay } from "vuetify";

// サインアウト処理に使用する認証ストア
import { useAuthStore } from "@/stores/useAuthStore";

// グローバルローディングダイアログ（処理中表示）
import AppLoadingDialog from "@/components/molecules/AppLoadingDialog.vue";

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
    <AppLoadingDialog />

    <!-- アプリケーション上部のツールバー -->
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>AirGuard</v-app-bar-title>
    </v-app-bar>

    <!-- サイドナビゲーション（ドロワー） -->
    <v-navigation-drawer
      v-model="drawer"
      :permanent="lgAndUp"
      :temporary="!lgAndUp"
      app
      width="240"
    >
      <!-- ナビゲーションリンク一覧 -->
      <v-list dense>
        <v-list-item title="Dashboard" to="/dashboard" />
        <v-list-item title="Users" to="/users" />
        <v-list-item title="Settings" to="/settings" />
      </v-list>

      <!-- セクション区切り -->
      <v-divider class="my-2" />

      <!-- サインアウト操作 -->
      <v-list-item
        title="Sign Out"
        @click="handleSignOut"
        prepend-icon="mdi-logout"
        class="text-error"
      />
    </v-navigation-drawer>

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
