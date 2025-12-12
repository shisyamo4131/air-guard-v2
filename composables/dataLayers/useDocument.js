/**
 * @file composables/dataLayers/useDocument.js
 * @version 1.0.0
 * @description A generic data layer composable for subscribing to a single Firestore document.
 * - Automatically subscribes to a document of a specified schema class on component mount.
 * - Automatically unsubscribes from the document on component unmount.
 * - Reactively updates when the document ID changes.
 * @author shisyamo4131
 * @create 2025-12-10
 *
 * @example
 * // Basic usage - Subscribe to a specific document
 * const { doc: customer } = useDocument('Customer', { docId: 'customer-id-123' })
 *
 * @example
 * // With reactive docId
 * const customerId = ref('customer-id-123')
 * const { doc: customer } = useDocument('Customer', { docId: customerId })
 * // When customerId.value changes, automatically re-subscribes
 *
 * @example
 * // Accessing document properties
 * const { doc: customer } = useDocument('Customer', { docId: 'customer-id-123' })
 * console.log(customer.name)      // Reactive property
 * console.log(customer.email)     // Reactive property
 * console.log(customer.status)    // Reactive property
 */
import * as Vue from "vue";
import * as Schemas from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * A composable for subscribing to a single Firestore document of any schema class.
 *
 * - Subscribes to the specified document using the provided docId.
 * - Automatically re-subscribes when docId changes (if reactive).
 * - Returns a reactive document instance that updates in real-time.
 *
 * @param {string} className - The name of the schema class (e.g., 'Customer', 'Site', 'Employee')
 * @param {Object} options - Options for subscribing to the document
 * @param {string|Ref<string>} options.docId - The document ID to subscribe to
 *   - Can be a static string or a reactive ref
 *   - Required and must be a non-empty string
 * @returns {Object} - The composable return object
 * @returns {Object} doc - Reactive document instance that updates in real-time
 *   - Contains all properties of the specified schema class
 *   - Updates automatically when the Firestore document changes
 *
 * @throws {Error} - Throws if the schema class is not found
 * @throws {Error} - Throws if docId is missing or not a string
 *
 * @see {@link https://firebase.google.com/docs/firestore/query-data/listen|Firestore Realtime Updates}
 */
export function useDocument(className, { docId } = {}) {
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

  // 3. Setup auth store for debugging purposes
  const { isDev } = useAuthStore();

  /** VALIDATION */
  if (!docId || typeof docId !== "string") {
    throw new Error(
      `A valid docId string is required. Received: ${typeof docId}`
    );
  }

  /**
   * Subscribe to the document with the specified docId.
   * @private
   * @returns {void}
   */
  function subscribe() {
    schemaInstance.subscribe({ docId });
  }

  /**
   * Unsubscribe from the document.
   * @private
   * @returns {void}
   */
  function unsubscribe() {
    schemaInstance.unsubscribe();
  }

  /**
   * Subscribe to the document on component mount.
   * - Automatically re-subscribes if docId is reactive and changes.
   */
  Vue.watchEffect(subscribe);

  /**
   * Unsubscribe from the document on component unmount.
   */
  Vue.onUnmounted(unsubscribe);

  return { doc: schemaInstance };
}
