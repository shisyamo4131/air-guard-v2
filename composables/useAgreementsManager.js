/*****************************************************************************
 * useAgreementsManager
 * @version 1.0.0
 * @description A composable to manage agreements information.
 * @author shisyamo4131
 *****************************************************************************/

import * as Vue from "vue";
import { useBaseManager } from "@/composables/useBaseManager";
import { Agreement } from "@/schemas";
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

  /** SETUP BASE MANAGER */
  const {
    attrs: baseAttrs,
    isDev,
    isLoading,
    router,
    logger,
  } = useBaseManager("AgreementsManager");

  /** SETUP `useAuthStore` to getting agreements from company */
  const { company } = useAuthStore();

  /** Merge own agreements and company's agreements as selectable items */
  const selectableAgreements = Vue.computed(() => {
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
      ...baseAttrs.value,
      modelValue: instance.agreements,
      schema: Agreement,
      errorMessages: {
        duplicateKey: "既に登録されている取極めです。",
      },
      itemKey: "key",
      selectableAgreements: selectableAgreements.value,
      "onUpdate:modelValue": (value) => (instance.agreements = value),
      "onSubmit:complete": () => instance.update(),
    };
  });

  return { attrs, isDev, isLoading, router, logger };
}
