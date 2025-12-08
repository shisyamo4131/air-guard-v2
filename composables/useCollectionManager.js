/**
 * useCollectionManager
 * @version 1.0.0
 * @description A base composable for managing collections by `AirArrayManager`.
 * @author shisyamo4131
 */
import * as Vue from "vue";
import { useBaseManager } from "@/composables/useBaseManager";

/**
 * @param {string} composableName - Name of the composable for logging purposes
 * @param {*} options - Options for the composable
 * @param {Array} options.docs - Array of document instances to manage
 * @param {Object} options.schema - Schema class for the documents
 * @param {string} options.createRedirectPath - Path to redirect after creation
 * @param {boolean|number} options.useDelay - Whether to use delay for reflection of `search` string in ms
 * @param {Array} options.sortBy - Array of sorting criteria
 * @returns {Object} - The collection manager composable
 * @returns {Object} attrs - Computed attributes for the collection component
 * @returns {Object} logger - Logger instance for logging messages and errors
 */
export function useCollectionManager(
  composableName = "useCollectionManager",
  { docs = [], schema, redirectPath = null, useDelay = false, sortBy = [] } = {}
) {
  /** SETUP BASE MANAGER COMPOSABLE */
  const {
    attrs: baseAttrs,
    isDev,
    isLoading,
    router,
    logger,
  } = useBaseManager(composableName);

  /** SETUP */
  const search = Vue.ref(null);

  /** VALIDATION */
  if (!schema) {
    logger.error({
      message: "'schema' parameter is required for useCollectionManager.",
    });
    return;
  }

  /**
   * @param {string} editMode
   * @param {Object} item
   * @returns
   */
  const _beforeEdit = (editMode, item) => {
    switch (editMode) {
      case "CREATE":
        return true;
      case "UPDATE":
        if (redirectPath) {
          router.push(`${redirectPath}/${item.docId}`);
          return false;
        }
        return true;
      case "DELETE":
        return true;
      default:
        logger.error({ message: `Unknown edit mode: ${editMode}` });
        return false;
    }
  };

  const _redirectAfterDelete = () => {
    if (!redirectPath) return;
    router.replace(redirectPath);
  };

  /**
   * Attributes for the `AirArrayManager` component.
   */
  const attrs = Vue.computed(() => {
    return {
      ...baseAttrs.value,
      modelValue: docs,
      schema,
      beforeEdit: _beforeEdit,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: useDelay ? useDelay : undefined,
      search: search.value,
      tableProps: {
        sortBy,
      },
      "onUpdate:search": (value) => (search.value = value),
      onDelete: () => _redirectAfterDelete(),
      onCreate: redirectPath
        ? (item) => router.push(`${redirectPath}/${item.docId}`)
        : undefined,
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
