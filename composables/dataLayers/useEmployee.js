/*****************************************************************************
 * useEmployee
 * @version 1.0.0
 * @description A data layer composable for employee details.
 * @author shisyamo4131
 * @create 2025-12-05
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { Employee } from "@/schemas";

/**
 * @param {*} options
 * @param {*} options.docId - The document ID of the Employee to subscribe to
 * @returns {Object} - The employee data layer composable
 * @returns {Object} doc - Reactive Employee instance
 */
export function useEmployee({ docId } = {}) {
  const employee = Vue.reactive(new Employee());

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
    employee.subscribe({ docId });
  }

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(() => {
    _subscribe();
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    employee.unsubscribe();
  });

  /***************************************************************************
   * RETURNED OBJECTS
   ***************************************************************************/
  return {
    doc: employee,
  };
}
