/*****************************************************************************
 * @file ./composables/dataLayers/useSiteEmployeeHistoriesBySiteId.js
 * @description 現場ドキュメントIDに紐づく現場従業員履歴ドキュメントのデータレイヤー
 *****************************************************************************/
import * as Vue from "vue";
import { SiteEmployeeHistory } from "@/schemas";

/*****************************************************************************
 * @property {string} siteId - 現場ドキュメントID
 *****************************************************************************/
export function useSiteEmployeeHistoriesBySiteId(siteId, { callback } = {}) {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new SiteEmployeeHistory());

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe() {
    const constraints = [["where", "siteId", "==", siteId]];
    if (callback) {
      instance.subscribeDocs({ constraints }, callback);
    } else {
      instance.subscribeDocs({ constraints });
    }
  }

  function unsubscribe() {
    instance.unsubscribe();
  }

  /*****************************************************************************
   * LIFECYCLE HOOKS
   *****************************************************************************/
  Vue.onMounted(subscribe);
  Vue.onUnmounted(unsubscribe);

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    docs: instance.docs,
  };
}
