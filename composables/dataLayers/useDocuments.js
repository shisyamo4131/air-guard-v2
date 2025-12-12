/**
 * @file composables/dataLayers/useDocuments.js
 * @version 1.0.0
 * @description A generic data layer composable for subscribing to Firestore documents.
 * - Automatically subscribes to documents of a specified schema class on component mount.
 * - Automatically unsubscribes from documents on component unmount.
 * - Supports both query-based and N-gram token search.
 * @author shisyamo4131
 * @create 2025-12-10
 *
 * @example
 * // Basic usage - Subscribe to all documents
 * const { docs: customers } = useDocuments('Customer')
 *
 * @example
 * // Query-based subscription
 * const { docs: activeCustomers } = useDocuments('Customer', {
 *   constraints: [
 *     ['where', 'status', '==', 'active'],
 *     ['orderBy', 'name', 'asc'],
 *     ['limit', 50]
 *   ]
 * })
 *
 * @example
 * // N-gram token search with additional options
 * const { docs: searchResults } = useDocuments('Customer', {
 *   constraints: '田中',  // Search string for tokenMap
 *   options: [
 *     ['orderBy', 'createdAt', 'desc'],
 *     ['limit', 20]
 *   ]
 * })
 */
import * as Vue from "vue";
import * as Schemas from "@/schemas";

/**
 * A composable for subscribing to multiple Firestore documents of any schema class.
 *
 * - If `constraints` is an array, performs a standard Firestore query.
 * - If `constraints` is a string, performs N-gram token search using `tokenMap` field.
 * - When using string search, `options` can provide additional query conditions.
 *
 * @param {string} className - The name of the schema class (e.g., 'Customer', 'Site', 'Employee')
 * @param {Object} [subscribeOptions={}] - Options for subscribing to documents
 * @param {Array<Array>|string} [subscribeOptions.constraints=[]] - Query conditions or search string
 *   - **Array format**: Standard Firestore query conditions
 *     - `['where', field, operator, value]` - Filter documents
 *     - `['orderBy', field, direction]` - Sort documents ('asc' or 'desc')
 *     - `['limit', number]` - Limit number of documents
 *   - **String format**: Search string for N-gram token search using `tokenMap`
 *     - Performs partial match search on documents with `tokenMap` field
 *     - Example: '田中' will match documents containing '田', '中', or '田中' tokens
 * @param {Array<Array>} [subscribeOptions.options=[]] - Additional query conditions (only used when constraints is a string)
 *   - Same format as array-based constraints
 *   - Applied after tokenMap filtering
 * @returns {Object} - The composable return object
 * @returns {Array} docs - Array of reactive document instances that updates in real-time
 *
 * @throws {Error} - Throws if the schema class is not found
 * @throws {Error} - Throws if constraints format is invalid
 *
 * @see {@link https://firebase.google.com/docs/firestore/query-data/queries|Firestore Queries}
 */
export function useDocuments(className, subscribeOptions = {}) {
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
    schemaInstance.subscribeDocs(subscribeOptions);
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
   * Subscribe to documents on component mount.
   */
  Vue.onMounted(subscribe);

  /**
   * Unsubscribe from documents on component unmount.
   */
  Vue.onUnmounted(unsubscribe);

  return { docs: schemaInstance.docs };
}
