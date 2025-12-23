/*****************************************************************************
 * useSitesManager
 * @version 1.0.0
 * @description A composable to manage sites information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";
import { useCollectionManager } from "@/composables/useCollectionManager";

/**
 * @returns {Object} - Sites manager attributes and information.
 * @returns {Object} attrs - The attributes for the sites manager.
 * @returns {Array} docs - The array of site documents.
 */
export function useSitesManager(
  {
    docs,
    redirectPath = "/sites",
    useDelay = false,
    sortBy = [{ key: "code", order: "desc" }],
    onUpdateSearch,
  } = {},
  additionalAttrs = {}
) {
  /** SETUP */
  const collectionManager = useCollectionManager(
    "useSitesManager",
    {
      docs,
      schema: Site,
      redirectPath,
      useDelay,
      sortBy,
      onUpdateSearch,
    },
    additionalAttrs
  );

  /** COMPUTED PROPERTIES */
  const attrs = Vue.computed(() => {
    return {
      ...collectionManager.attrs.value,
    };
  });

  return { attrs };
}
