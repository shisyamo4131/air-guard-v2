/*****************************************************************************
 * @file ./composables/dataLayers/useSitesMustBeTerminated.js
 * @description 稼働終了に状態を変更すべき現場インスタンスの配列を返す
 * - `status` が `ACTIVE` で、かつ `hasConstructionPeriodEndAt` が `true` である現場について
 *   `constructionPeriodEndAt` が現在日時よりも一定期間前である場合に、稼働終了に状態を変更すべき現場として判断する。
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { Timestamp } from "firebase/firestore";
import { Site } from "@/schemas";

export function useSitesMustBeTerminated() {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const siteInstance = Vue.reactive(new Site());
  const today = dayjs().tz("Asia/Tokyo").startOf("day").toDate();
  const constraints = [
    ["where", "status", "==", Site.STATUS_ACTIVE],
    ["where", "hasConstructionPeriodEndAt", "==", true],
    ["where", "constructionPeriodEndAt", "<", Timestamp.fromDate(today)],
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
