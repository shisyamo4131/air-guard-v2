import * as Vue from "vue";
import { useCompanyStore } from "@/stores/useCompanyStore";
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
  const companyStore = useCompanyStore();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const internalType = Vue.isRef(type) ? type : Vue.ref(type);

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const siteShiftTypeOrder = Vue.computed(() => {
    if (internalType.value === TYPE.ARRANGEMENT) {
      return companyStore.company.siteOrder || [];
    }
    if (internalType.value === TYPE.SCHEDULE) {
      return companyStore.company.scheduleOrder || [];
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
