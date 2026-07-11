import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

/*****************************************************************************
 * @file ./composables/domain/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js
 * @description
 * - `SiteShiftTypeOrder` の更新処理を提供します。
 *****************************************************************************/
export function useSiteShiftTypeOrderActions({
  type = Vue.ref(TYPE.ARRANGEMENT),
} = {}) {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();
  const loadings = useLoadingsStore();

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useSiteShiftTypeOrderActions", useErrorsStore());

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const internalType = Vue.isRef(type) ? type : Vue.ref(type);

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const currentOrder = Vue.computed({
    get() {
      if (internalType.value === TYPE.ARRANGEMENT) {
        return auth.company.siteOrder || [];
      }
      if (internalType.value === TYPE.SCHEDULE) {
        return auth.company.scheduleOrder || [];
      }
      return [];
    },
    set(newOrder) {
      if (internalType.value === TYPE.ARRANGEMENT) {
        auth.company.siteOrder = newOrder;
      }
      if (internalType.value === TYPE.SCHEDULE) {
        auth.company.scheduleOrder = newOrder;
      }
    },
  });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 更新された現場オーダーを保存します。
   * - `auth.company` の `siteOrder` または `scheduleOrder` を更新する直前、
   * @param {Array} newOrder 更新された現場オーダー配列
   */
  const update = async (newOrder) => {
    const key = loadings.add("勤務区分オーダーを更新しています...");
    try {
      currentOrder.value = newOrder;
      await auth.company.update();
    } catch (error) {
      logger.error({ error });
    } finally {
      loadings.remove(key);
    }
  };

  /**
   * 指定された現場勤務区分オーダーを削除します。
   * @param {string} orderKey 削除する現場勤務区分オーダーのキー
   */
  const remove = async (orderKey) => {
    const newOrder = currentOrder.value.filter(
      (order) => order.key !== orderKey,
    );
    await update(newOrder);
  };

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return { update, remove };
}
