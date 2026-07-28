/*****************************************************************************
 * @file ./stores/useSystemStore.js
 * @description システムの状態管理用ストア
 *****************************************************************************/
import { computed, reactive } from "vue";
import { System } from "@/schemas";
import { useCompanyStore } from "@/stores/useCompanyStore";

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
  const companyStore = useCompanyStore();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const systemInstance = reactive(new System());

  /**
   * システム全体または現在の会社がメンテナンス中かどうかを返します。
   */
  const isMaintenance = computed(() => {
    return (
      systemInstance.isMaintenance ||
      companyStore.company.maintenanceMode ||
      false
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
