<script setup>
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/useAppStore";
import { useAuthActions } from "@/composables/application/auth/useAuthActions";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/** SETUP STORES */
const appStore = useAppStore();
const messages = useMessagesStore();
const { queue } = useLoadingsStore();

const { signOut } = useAuthActions();
const loadings = useLoadingsStore();
const logger = useLogger("default-layout", useErrorsStore());

// ルーターと認証ストアの取得
const router = useRouter();

/**
 * サインアウト処理
 * Handle user sign-out and redirect to top page
 */
const handleSignOut = async () => {
  const loadingsKey = loadings.add("サインアウトしています...");
  try {
    await signOut();
    messages.add("サインアウトしました。");
    await router.push("/");
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(loadingsKey);
  }
};
</script>

<template>
  <v-app>
    <!-- グローバルローディング状態を表示するダイアログ -->
    <air-loading-dialog :model-value="queue" />

    <!-- SNACKBAR FOR GLOBAL MESSAGE -->
    <v-snackbar-queue v-model="messages.queue" location="top" />

    <!-- アプリケーション上部のツールバー -->
    <v-app-bar v-bind="appStore.appBar">
      <template #prepend>
        <v-app-bar-nav-icon v-bind="appStore.navIcon" />
        <v-btn v-bind="appStore.previousButton" />
      </template>
      <template v-slot:append>
        <UserSetting>
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" icon="mdi-account-cog" />
          </template>
        </UserSetting>
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
    <v-main>
      <NuxtPage
        :keepalive="{
          include: [
            'customers-index',
            'sites-index',
            'employees-index',
            'employees-terminated-index',
            'outsourcers-index',
            'operation-results-index',
            'billings-operations-index',
            'billings-customers-index',
          ],
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

/* 
  Sortable.js drag-and-drop global styles
  Applied to elements appended to body during drag operation.
  Used by: DraggableWorkers.vue, WorkerSelector.vue
*/
.sortable-drag,
.sortable-fallback {
  z-index: 99999 !important;
  opacity: 0.9 !important;
  cursor: grabbing !important;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important;
}
</style>
