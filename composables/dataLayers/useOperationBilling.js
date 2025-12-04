/*****************************************************************************
 * useOperationBilling
 * @version 1.0.0
 * @description A data layer composable for operation billing details.
 * - Subscribes to operation billing document immediately.
 * - Requires dateRange composable.
 * @author shisyamo4131
 * @create 2025-11-22
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { OperationBilling } from "@/schemas";

/**
 * @param {*} options
 * @param {*} options.docId - The document ID of the OperationBilling to subscribe to
 * @param {*} options.dateRangeComposable
 * @param {*} options.useDebounced - Whether to use debounced date range (default: false)
 * @returns {Object} - The operation billing data layer composable
 * @returns {Object} doc - Reactive OperationBilling instance
 */
export function useOperationBilling({ docId } = {}) {
  const instance = Vue.reactive(new OperationBilling());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  // Validate docId
  if (!docId || typeof docId !== "string") {
    throw new Error("A valid docId string is required");
  }

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe() {
    instance.subscribe({ docId });
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(() => {
    _subscribe();
  });

  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  /***************************************************************************
   * RETURNED OBJECTS
   ***************************************************************************/
  return { doc: instance };
}
