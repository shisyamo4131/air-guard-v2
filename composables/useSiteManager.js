/*****************************************************************************
 * useSiteManager
 * @version 1.0.0
 * @description A composable to manage site information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive site instance to manage
 * @param {string} options.deleteRedirectPath - Path to redirect after deletion
 * @returns {Object} - The site manager composable
 * @returns {Object} doc - Reactive site instance
 * @returns {Object} attrs - Computed attributes for the site component
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useSiteManager({
  doc = Vue.reactive(new Site()),
  deleteRedirectPath = "/sites",
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useSiteManager", {
    doc,
    deleteRedirectPath,
  });

  /** COMPUTED PROPERTIES */
  // Attributes for the component
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,
    };
  });

  // An array of information for the information-card component
  const info = Vue.computed(() => {
    const base = [
      {
        title: "CODE",
        props: { subtitle: doc.code, prependIcon: "mdi-tag" },
      },
      {
        title: "住所",
        props: {
          subtitle: `${doc.zipcode} ${doc.fullAddress}`,
          prependIcon: "mdi-map-marker",
        },
      },
      {
        title: "建物名",
        props: {
          subtitle: doc.building || "-",
          prependIcon: "mdi-office-building-marker",
        },
      },
      {
        title: "取引先",
        props: {
          subtitle: doc.customer?.name || "loading",
          prependIcon: "mdi-domain",
        },
      },
      {
        title: "備考",
        props: {
          subtitle: doc.remarks || "-",
          prependIcon: "mdi-comment-text",
          lines: "two",
        },
      },
    ];
    return { base };
  });

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    ...docManager,
    attrs,
    info,
  };
}
