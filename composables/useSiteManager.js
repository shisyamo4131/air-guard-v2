/*****************************************************************************
 * useSiteManager
 * @version 1.0.0
 * @description A composable to manage site information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useRouter } from "vue-router";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive Site instance to manage
 * @param {string} options.deleteRedirectPath - Path to redirect after deletion
 * @returns {Object} - The site manager composable
 * @returns {Object} doc - Reactive Site instance
 * @returns {Object} attrs - Computed attributes for the site component
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {Function} set - Method to set docId to subscribe.
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 */
export function useSiteManager({ doc, deleteRedirectPath = "/sites" } = {}) {
  /** SETUP LOGGER COMPOSABLE */
  const logger = useLogger("SiteManager", useErrorsStore());

  /** SETUP AUTH STORE FOR DEBUGGING PURPOSES */
  const { isDev } = useAuthStore();

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const router = useRouter();

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const component = Vue.ref(null);

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the component */
  const attrs = Vue.computed(() => {
    return {
      ref: (el) => (component.value = el),
      modelValue: doc,
      handleCreate: (item) => item.create(),
      handleUpdate: (item) => item.update(),
      handleDelete: (item) => item.delete(),
      inputProps: {
        excludedKeys: ["agreements"],
      },
      onDelete: () => router.replace(deleteRedirectPath),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": logger.clearError,
    };
  });

  /** Information for the `information-card` */
  const info = Vue.computed(() => {
    const base = [
      {
        title: "CODE",
        props: { subtitle: doc.code, prependIcon: "mdi-code-tags" },
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
    attrs,
    info,

    toCreate: (item) => component?.value?.toCreate?.(item),
    toUpdate: (item) => component?.value?.toUpdate?.(item),
    toDelete: (item) => component?.value?.toDelete?.(item),
  };
}
