/*****************************************************************************
 * @file ./stores/useSystemStore.js
 * @description システムの状態管理用ストア
 *****************************************************************************/
import { computed, reactive } from "vue";
import { System } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @returns {{
 *  system: import("vue").Reactive<System>,
 *  isMaintenance: import("vue").ComputedRef<boolean>
 * }}
 */
export const useSystemStore = defineStore("system", () => {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const systemInstance = reactive(new System());

  /**
   * システム全体または現在の会社がメンテナンス中かどうかを返します。
   */
  const isMaintenance = computed(() => {
    return (
      systemInstance.isMaintenance || auth.company.maintenanceMode || false
    );
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    system: systemInstance,
    isMaintenance,
  };
});
