/*****************************************************************************
 * useCertificationsManager
 * @version 1.0.0
 * @description A composable to manage certifications information.
 * @author shisyamo4131
 *****************************************************************************/

import * as Vue from "vue";
import { useBaseManager } from "@/composables/useBaseManager";
import { Certification } from "@/schemas";
import { CERTIFICATION_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

/**
 * @param {Object} instance - The instance containing certifications.
 * @returns {Object} - Certifications manager attributes.
 * @returns {Object} attrs - Attributes for the certifications manager component.
 */
export function useCertificationsManager(instance) {
  /** SETUP BASE MANAGER */
  const {
    attrs: baseAttrs,
    isDev,
    isLoading,
    router,
    logger,
  } = useBaseManager("CertificationsManager");

  /** Attributes for the manager component */
  const attrs = Vue.computed(() => {
    return {
      ...baseAttrs.value,
      modelValue: instance.securityCertifications,
      schema: Certification,
      errorMessages: {
        duplicateKey: "既に登録されている資格です。",
      },
      itemKey: "key",
      tableProps: {
        headers: [
          { title: "資格名", key: "name" },
          {
            title: "種別",
            key: "certificationType",
            value: (item) => {
              return (
                CERTIFICATION_TYPE_VALUES?.[item.type]?.title || "...loading"
              );
            },
            align: "center",
          },
        ],
        hideDefaultFooter: true,
        hideSearch: true,
        itemsPerPage: -1,
        // sortBy: [{ key: "dateAt", order: "desc" }],
      },
      "onUpdate:modelValue": (value) =>
        (instance.securityCertifications = value),
      "onSubmit:complete": () => instance.update(),
    };
  });

  return { attrs, isDev, isLoading, router, logger };
}
