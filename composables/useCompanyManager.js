/*****************************************************************************
 * useCompanyManager
 * @version 1.0.0
 * @description A composable to manage company information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @returns {Object} - Company manager attributes and information.
 * @returns {Object} attrs - Attributes for the item manager component.
 */
export function useCompanyManager() {
  const { company } = useAuthStore();
  const docManager = useDocManager("useCompanyManager", {
    doc: company,
  });

  /** METHODS (PRIVATE) */
  const _handleCreate = () => {
    throw new Error("Creation is not implemented");
  };

  const _handleDelete = () => {
    throw new Error("Deletion is not implemented");
  };

  /** COMPUTED PROPERTIES */
  // Attributes for the item manager
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,
      handleCreate: _handleCreate,
      handleDelete: _handleDelete,
      disableDelete: true,
      hideDeleteBtn: true,
    };
  });

  /***************************************************************************
   * RETURN OBJECTS
   ***************************************************************************/
  return { ...docManager, attrs };
}
