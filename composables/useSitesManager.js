/*****************************************************************************
 * useSitesManager
 * @version 1.0.0
 * @description A composable to manage sites information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";
import { useCollectionManager } from "@/composables/useCollectionManager";
import MoleculesInputsSiteForRegist from "@/components/molecules/inputs/siteForRegist";

/**
 * @returns {Object} - Sites manager attributes and information.
 * @returns {Object} attrs - The attributes for the sites manager.
 * @returns {Array} docs - The array of site documents.
 */
export function useSitesManager(
  { docs, redirectPath = "/sites", useDelay = false, onUpdateSearch } = {},
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
      onUpdateSearch,
    },
    additionalAttrs
  );

  /** COMPUTED PROPERTIES */
  const attrs = Vue.computed(() => {
    return {
      ...collectionManager.attrs.value,
      customInput: ({ editMode }) => {
        if (editMode === "CREATE") return MoleculesInputsSiteForRegist;
        return null;
      },
    };
  });

  return { attrs };
}
