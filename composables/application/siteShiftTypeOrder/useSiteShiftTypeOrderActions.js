import * as Vue from "vue";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

/*****************************************************************************
 * @file ./composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js
 * @description
 * - 現場勤務区分オーダーの更新・削除を、画面操作から利用しやすい形で提供する
 *   application composable です。
 * - companyStore.company の更新処理、loading、error handling を担当します。
 *****************************************************************************/
export function useSiteShiftTypeOrderActions({
  type = Vue.ref(TYPE.ARRANGEMENT),
} = {}) {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const companyStore = useCompanyStore();
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
        return companyStore.company.siteOrder || [];
      }
      if (internalType.value === TYPE.SCHEDULE) {
        return companyStore.company.scheduleOrder || [];
      }
      return [];
    },
    set(newOrder) {
      if (internalType.value === TYPE.ARRANGEMENT) {
        companyStore.company.siteOrder = newOrder;
      }
      if (internalType.value === TYPE.SCHEDULE) {
        companyStore.company.scheduleOrder = newOrder;
      }
    },
  });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 更新された現場オーダーを保存します。
   * - `companyStore.company` の `siteOrder` または `scheduleOrder` を更新する直前、
   * @param {Array} newOrder 更新された現場オーダー配列
   */
  const update = async (newOrder) => {
    const key = loadings.add("勤務区分オーダーを更新しています...");
    try {
      currentOrder.value = newOrder;
      await companyStore.company.update();
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
