/**
 * useDocManager
 * @version 1.0.0
 * @description A base composable for managing document by `AirItemManager`.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useRouter } from "vue-router";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @param {string} composableName - Name of the composable for logging purposes
 * @param {*} options - Options for the composable
 * @param {Object} options.doc - Reactive document instance to manage
 * @param {string} options.deleteRedirectPath - Path to redirect after deletion
 * @returns {Object} - The manager composable
 * @returns {Object} doc - Reactive document instance
 * @returns {Object} attrs - Computed attributes for the manager component
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useDocManager(
  composableName = "useDocManager",
  { doc, deleteRedirectPath = null } = {}
) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger(composableName, useErrorsStore());

  /** SETUP ROUTER */
  const router = useRouter();

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /** VALIDATION */
  if (isDev && (!doc || typeof doc !== "object")) {
    logger.error({
      message: "Invalid 'doc' parameter provided to useDocManager.",
    });
    return;
  }

  if (isDev && !deleteRedirectPath) {
    logger.warn({
      message:
        "'deleteRedirectPath' is not provided. Make sure to handle redirection after deletion.",
    });
  }

  /** SETUP REACTIVE OBJECTS */
  const component = Vue.ref(null);
  const isLoading = Vue.ref(false);

  /** METHODS (PRIVATE) */
  const _redirectAfterDelete = () => {
    if (!deleteRedirectPath) return;
    router.replace(deleteRedirectPath);
  };

  /** COMPUTED PROPERTIES */
  // Attributes for the component
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: doc,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      isLoading: isLoading.value,
      onDelete: () => _redirectAfterDelete(),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
      "onUpdate:isLoading": (value) => (isLoading.value = value),
    };
  });

  return {
    doc,
    attrs,

    isDev,
    isLoading,

    router,
    logger,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
