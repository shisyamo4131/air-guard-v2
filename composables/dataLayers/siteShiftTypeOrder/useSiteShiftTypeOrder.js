import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

/*****************************************************************************
 * @file ./composables/dataLayers/siteShiftTypeOrder/useSiteShiftTypeOrder.js
 * @description 現場勤務区分オーダーのデータレイヤーコンポーザブル
 *****************************************************************************/
export function useSiteShiftTypeOrder({
  type = Vue.ref(TYPE.ARRANGEMENT),
} = {}) {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const internalType = Vue.isRef(type) ? type : Vue.ref(type);

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const siteShiftTypeOrder = Vue.computed(() => {
    if (internalType.value === TYPE.ARRANGEMENT) {
      return auth.company.siteOrder || [];
    }
    if (internalType.value === TYPE.SCHEDULE) {
      return auth.company.scheduleOrder || [];
    }
    return [];
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    siteShiftTypeOrder,
  };
}
