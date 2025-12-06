/**
 * @file composables/dataLayers/useEmployees.js
 * @description A data layer composable for multiple employees.
 * @author shisyamo4131
 * @create 2025-12-05
 */
import * as Vue from "vue";
import { Employee } from "@/schemas";

/**
 * @param {Object} subscribeOptions - Options for subscribing to Employee documents
 * @returns {Object} - The employees data layer composable
 * @returns {Array} docs - Array of reactive Employee instances
 */
export function useEmployees(subscribeOptions = {}) {
  /** SETUP */
  const instance = Vue.reactive(new Employee());

  /**
   * Subscribe to Employee documents based on provided options.
   * @private
   * @returns {void}
   */
  function _subscribe() {
    instance.subscribeDocs(subscribeOptions);
  }

  /**
   * Subscribe to Employee documents on component mount.
   */
  Vue.onMounted(() => {
    _subscribe();
  });

  /**
   * Unsubscribe from Employee documents on component unmount.
   */
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  return { docs: instance.docs };
}
