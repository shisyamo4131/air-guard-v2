/*****************************************************************************
 * @file ./composables/dataLayer/useActiveSites.js
 * @description A composable to providing active `Site` documents.
 *****************************************************************************/
import * as Vue from "vue";
import { useConstants } from "@/composables/useConstants";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

export function useActiveSites({ customerId } = {}) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const { SITE_STATUS } = useConstants();

  /** 稼働中現場ドキュメントの取得 */
  const { docs } = useDocuments("Site", {
    options: computed(() => {
      const result = [
        ["where", "status", "==", SITE_STATUS.value.ACTIVE.value],
      ];
      if (customerId) {
        result.push(["where", "customerId", "==", customerId]);
      }
      return result;
    }),
    fetchAllOnEmpty: true,
  });

  return { docs };
}
