/*****************************************************************************
 * @file ./plugins/07.system.js
 * @description システムの状態初期化とメンテナンス画面への遷移を担当する Nuxt プラグイン
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSystemActions } from "@/composables/application/system/useSystemActions";
import { useRouter } from "vue-router";

/**
 * - `useAuthStore.isMaintenance` の状態を監視し、メンテナンスモードの切り替えに応じてルーティングを制御します。
 * - `useSystemActions.initializeSystem` で システムの状態を初期化します。
 */
export default defineNuxtPlugin(async () => {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const auth = useAuthStore();
  const router = useRouter();
  const { initializeSystem } = useSystemActions();

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(
    () => auth.isMaintenance,
    (newVal) => {
      const currentPath = router.currentRoute.value.path;
      if (newVal) {
        if (currentPath === "/maintenance") return;
        router.replace("/maintenance");
      } else {
        if (currentPath !== "/maintenance") return;
        router.replace("/");
      }
    },
  );
  await initializeSystem();
});
