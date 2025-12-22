/**
 * @file composables/dataLayers/useDocuments.js
 * @version 1.0.0
 * @description A generic data layer composable for subscribing to Firestore documents.
 * - Supports N-gram token search with improved parameter structure.
 * - Automatically subscribes to documents of a specified schema class on component mount.
 * - Automatically re-subscribes when `search` or `options` change (if provided as refs).
 * - Automatically unsubscribes from documents on component unmount.
 * @author shisyamo4131
 * @create 2025-12-22
 */
import * as Vue from "vue";
import * as Schemas from "@/schemas";

/**
 * A composable for subscribing to multiple Firestore documents of any schema class
 * using N-gram token search.
 * @param {*} className
 * @param {*} options
 * @param {Ref<string|null>} [options.search=null] - Search string for N-gram token search. If null or shorter than `minSearchLength`, no search is performed.
 * @param {Ref<Array>} [options.options=[]] - Additional query options (e.g., orderBy, limit) when performing search.
 * @param {number} [options.minSearchLength=2] - Minimum length of `search` string to trigger search.
 * @param {boolean} [options.fetchAllOnEmpty=false] - If true, fetch all documents when `search` is null or empty.
 * @returns {Object} - An object containing the reactive `docs` array.
 */
export function useDocuments(
  className,
  {
    search = Vue.ref(null),
    options = Vue.ref([]),
    minSearchLength = 2,
    fetchAllOnEmpty = false,
  } = {}
) {
  /** VALIDATION */

  // 1. `search` and `options` must be a ref.
  if (!Vue.isRef(search) || !Vue.isRef(options)) {
    throw new Error("`search` and `options` must be Vue refs.");
  }

  // 2. `search` must be a string if provided
  if (search.value && typeof search.value !== "string") {
    throw new Error("`search` must be a string if provided.");
  }

  // 3. `options` must be an array
  if (!Array.isArray(options.value)) {
    throw new Error("`options` must be an array.");
  }

  /** SETUP */

  // 1. Retrieve the schema class
  const SchemaClass = Schemas?.[className];
  if (!SchemaClass) {
    const availableClasses = Object.keys(Schemas).join(", ");
    throw new Error(
      `Schema class "${className}" not found in @/schemas. ` +
        `Available classes: ${availableClasses}`
    );
  }

  // 2. Create a reactive instance of the schema class
  const schemaInstance = Vue.reactive(new SchemaClass());

  /**
   * Subscribe to documents based on provided options.
   * @private
   * @returns {void}
   */
  function subscribe() {
    if (search.value && search.value.length >= minSearchLength) {
      const constraints = search.value;
      schemaInstance.subscribeDocs({ constraints, options: options.value });
    } else if (!search.value && fetchAllOnEmpty) {
      const constraints = options.value;
      schemaInstance.subscribeDocs({ constraints });
    } else {
      schemaInstance.unsubscribe();
    }
  }

  /**
   * Unsubscribe from documents.
   * @private
   * @returns {void}
   */
  function unsubscribe() {
    schemaInstance.unsubscribe();
  }
  /**
   * Unsubscribe from documents on component unmount.
   */
  Vue.onUnmounted(unsubscribe);

  /**
   * Re-subscribe to documents when `search` or `options` change.
   */
  Vue.watchEffect(subscribe);

  return {
    docs: schemaInstance.docs,
  };
}
