/**
 * useCollectionManager
 * @version 1.0.0
 * @description A base composable for managing collections by `AirArrayManager`.
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
  {
    docs = [],
    schema,
    createRedirectPath = null,
    useDelay = false,
    sortBy = [],
  } = {}
) {
  /** SETUP */
  const { isDev } = useAuthStore();
  const logger = useLogger(composableName, useErrorsStore());
  const router = useRouter();
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
  const beforeEdit = (editMode, item) => {
    switch (editMode) {
      case "CREATE":
        return true;
      case "UPDATE":
        if (createRedirectPath) {
          router.push(`${createRedirectPath}/${item.docId}`);
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

  /**
   * Attributes for the `AirArrayManager` component.
   */
  const attrs = Vue.computed(() => {
    return {
      modelValue: docs,
      schema,
      beforeEdit,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      delay: useDelay ? useDelay : undefined,
      search: search.value,
      tableProps: {
        sortBy,
      },
      "onUpdate:search": (value) => (search.value = value),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": () => logger.clearError(),
      onCreate: createRedirectPath
        ? (item) => router.push(`${createRedirectPath}/${item.docId}`)
        : undefined,
    };
  });

  return { attrs, logger };
}
