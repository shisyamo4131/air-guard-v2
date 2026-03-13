/*****************************************************************************
 * useAgreementsManager
 * @version 1.0.0
 * @description A composable to manage agreements information.
 * @author shisyamo4131
 *****************************************************************************/

import * as Vue from "vue";
import { useBaseManager } from "@/composables/useBaseManager";
import { Agreement } from "@/schemas";

/**
 * @param {Object} instance - The instance containing agreements.
 * @returns {Object} - Agreements manager attributes.
 * @returns {Object} attrs - Attributes for the agreements manager component.
 */
export function useAgreementsManager(instance) {
  /** SETUP BASE MANAGER */
  const {
    attrs: baseAttrs,
    isDev,
    isLoading,
    router,
    logger,
  } = useBaseManager("AgreementsManager");

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
      "onUpdate:modelValue": (value) => {
        instance.agreements = value;
      },
      "onSubmit:complete": async () => {
        await instance.update();
      },
    };
  });

  return { attrs, isDev, isLoading, router, logger };
}
