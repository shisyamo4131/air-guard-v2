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
 * @param {string} options.redirectPath - Path to redirect after creation
 * @param {boolean|number} options.useDelay - Whether to use delay for reflection of `search` string in ms
 * @param {function} options.onUpdateSearch - Callback function when search is updated
 * @param {string} options.itemKey - Key to identify each document (default: 'docId')
 * @param {Object} additionalAttrs - Additional attributes to pass to the collection component
 * @returns {Object} - The collection manager composable
 * @returns {Object} attrs - Computed attributes for the collection component
 * @returns {Object} keyMappedDocs - Computed object mapping itemKey to document instances
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} isLoading - Reactive loading state
 * @returns {Object} router - Vue Router instance for navigation
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useCollectionManager(
  composableName = "useCollectionManager",
  {
    docs = [],
    schema,
    redirectPath = null,
    useDelay = false,
    onUpdateSearch,
    itemKey = "docId",
  } = {},
  additionalAttrs = {}
) {
  /** SETUP BASE MANAGER COMPOSABLE */
  const baseManager = useBaseManager(composableName);

  /** SETUP SEARCH */
  const search = Vue.ref(null);

  /** VALIDATION */
  if (!schema) {
    baseManager.logger.error({
      message: "'schema' parameter is required for useCollectionManager.",
    });
    return;
  }

  /**
   * @param {string} editMode
   * @param {Object} item
   * @returns {boolean}
   */
  const _beforeEdit = (editMode, item) => {
    switch (editMode) {
      case "CREATE":
        return true;
      case "UPDATE":
        if (redirectPath) {
          baseManager.router.push(`${redirectPath}/${item.docId}`);
          return false;
        }
        return true;
      case "DELETE":
        return true;
      default:
        baseManager.logger.error({ message: `Unknown edit mode: ${editMode}` });
        return false;
    }
  };

  /**
   * Attributes for the `AirArrayManager` component.
   */
  const attrs = Vue.computed(() => {
    return {
      ...baseManager.attrs.value,
      ...additionalAttrs,
      modelValue: docs,
      schema,
      beforeEdit: _beforeEdit,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: useDelay ? useDelay : undefined,
      search: Vue.unref(search),
      onCreate: redirectPath
        ? (item) => baseManager.router.push(`${redirectPath}/${item.docId}`)
        : undefined,
      "onUpdate:search": (val) => {
        search.value = val;
        if (onUpdateSearch) onUpdateSearch(val);
      },
    };
  });

  const keyMappedDocs = Vue.computed(() => {
    return docs.reduce((acc, doc) => {
      {
        acc[doc[itemKey]] = doc;
        return acc;
      }
    }, {});
  });

  return {
    ...baseManager,
    attrs,

    keyMappedDocs,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
