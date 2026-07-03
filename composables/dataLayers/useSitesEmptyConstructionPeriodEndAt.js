/*****************************************************************************
 * @file ./composables/dataLayers/useSitesEmptyConstructionPeriodEndAt.js
 * @description 稼働中の状態で工期終了日が設定されていない現場インスタンスの配列を提供する。
 * - `status` が `ACTIVE` で、かつ `constructionPeriodEndAt` が `null` である現場について
 *   工期終了日が設定されていない場合に、工期終了日の設定を促すためのデータとして利用する。
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";

export function useSitesEmptyConstructionPeriodEndAt() {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const siteInstance = Vue.reactive(new Site());
  const constraints = [
    ["where", "status", "==", Site.STATUS_ACTIVE],
    ["where", "constructionPeriodEndAt", "==", null],
  ];

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe() {
    siteInstance.subscribeDocs({ constraints });
  }

  function unsubscribe() {
    siteInstance.unsubscribe();
  }

  /*****************************************************************************
   * LIFECYCLE HOOKS
   *****************************************************************************/
  Vue.onMounted(subscribe);
  Vue.onUnmounted(unsubscribe);

  /*****************************************************************************
   * RETURN VALUES
   *****************************************************************************/
  return {
    docs: siteInstance.docs,
  };
}
