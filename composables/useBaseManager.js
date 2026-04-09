/*****************************************************************************
 * @file ./composables/useBaseManager.js
 * @description AirArrayManager, AirItemManager 専用 基本コンポーザブル
 * - `logger` や `router`, `isDev`, `isLoading` などの基本的な状態を提供。
 * - `attrs` を計算して、エラー処理やローディング状態の更新などの基本的なビヘイビアを提供。
 *****************************************************************************/
import * as Vue from "vue";
import { useRouter } from "vue-router";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @param {string} composableName - Name of the composable for logging purposes
 * @returns {Object} - The manager composable
 * @returns {Object} attrs - Computed attributes for the manager component
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} isLoading - Reactive loading state
 * @returns {Object} router - Vue Router instance for navigation
 * @returns {Object} logger - Logger instance for logging messages and errors
 */
export function useBaseManager(composableName = "useBaseManager") {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger(composableName, useErrorsStore());

  /** SETUP ROUTER */
  const router = useRouter();

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /** SETUP REACTIVE OBJECTS */
  const isLoading = Vue.ref(false);

  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      isLoading: isLoading.value,
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
      "onUpdate:isLoading": (value) => (isLoading.value = value),
    };
  });

  return {
    attrs,
    isDev,
    isLoading,
    router,
    logger,
  };
}
