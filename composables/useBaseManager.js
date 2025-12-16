/**
 * useBaseManager
 * @version 1.0.0
 * @description A base manager composable providing isLoading, logger, router, isDev (from useAuthStore) and basical `attrs` set errors behavor.
 * @author shisyamo4131
 */
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
