/*****************************************************************************
 * useAgreementsManager
 * @version 1.0.0
 * @description A composable to manage agreements information.
 * @author shisyamo4131
 *****************************************************************************/

import * as Vue from "vue";
import { Agreement } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @param {Object} instance - The instance containing agreements.
 * @param {Object} options - Options for the agreements manager.
 * @param {boolean} options.useDefault - Whether to include company agreements as selectable items.
 * @returns {Object} - Agreements manager attributes.
 * @returns {Object} attrs - Attributes for the agreements manager component.
 */
export function useAgreementsManager(instance, options = {}) {
  const { useDefault = false } = options;

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("AgreementsManager", useErrorsStore());
  const { company } = useAuthStore();

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const selectableItems = Vue.computed(() => {
    const companyAgreements = company.agreements || [];
    if (useDefault) {
      return [...companyAgreements, ...instance.agreements];
    } else {
      return [...instance.agreements];
    }
  });

  /** Attributes for the manager component */
  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.agreements,
      schema: Agreement,
      errorMessages: {
        duplicateKey: "既に登録されている取極めです。",
      },
      itemKey: "key",
      selectableItems: selectableItems.value,
      tableProps: {
        hideDefaultFooter: true,
        hideSearch: true,
        itemsPerPage: -1,
        sortBy: [{ key: "dateAt", order: "desc" }],
      },
      "onUpdate:modelValue": (value) => (instance.agreements = value),
      "onSubmit:complete": () => instance.update(),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": () => logger.clearError(),
    };
  });

  return { attrs };
}
