/**
 * useDocManager
 * @version 1.0.0
 * @description A base composable for managing document by `AirItemManager`.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useBaseManager } from "@/composables/useBaseManager";

/**
 * @param {string} composableName - Name of the composable for logging purposes
 * @param {*} options - Options for the composable
 * @param {Object} options.doc - Reactive document instance to manage
 * @param {string} options.redirectPath - Path to redirect after the doc is out of scope like deletion.
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
  { doc, redirectPath = null } = {}
) {
  /** SETUP BASE MANAGER COMPOSABLE */
  const {
    attrs: baseAttrs,
    isDev,
    isLoading,
    router,
    logger,
  } = useBaseManager(composableName);

  /** VALIDATION */
  if (isDev && (!doc || typeof doc !== "object")) {
    logger.error({
      message: "Invalid 'doc' parameter provided to useDocManager.",
    });
    return;
  }

  if (isDev && !redirectPath) {
    logger.warn({
      message:
        "'redirectPath' is not provided. Make sure to handle redirection after deletion. Please ignore this warning if you use this composable without deletion.",
    });
  }

  /** SETUP REACTIVE OBJECTS */
  const component = Vue.ref(null);

  /** METHODS (PRIVATE) */
  const _redirectAfterDelete = () => {
    if (!redirectPath) return;
    router.replace(redirectPath);
  };

  /** COMPUTED PROPERTIES */
  // Attributes for the component
  const attrs = Vue.computed(() => {
    return {
      ...baseAttrs,
      ref: (el) => (component.value = el),
      modelValue: doc,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      onDelete: () => _redirectAfterDelete(),
    };
  });

  return {
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
