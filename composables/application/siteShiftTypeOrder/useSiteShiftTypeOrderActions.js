import * as Vue from "vue";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCompanyFunctions } from "@/composables/company/useCompanyFunctions";
import { TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

const FIELD_BY_TYPE = Object.freeze({
  [TYPE.ARRANGEMENT]: "siteOrder",
  [TYPE.SCHEDULE]: "scheduleOrder",
});

const PERMISSION_BY_TYPE = Object.freeze({
  [TYPE.ARRANGEMENT]: "sites:write",
  [TYPE.SCHEDULE]: "site-operation-schedules:write",
});

/*****************************************************************************
 * @file ./composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js
 * @description
 * - 現場勤務区分オーダーの更新・削除を、画面操作から利用しやすい形で提供する
 *   application composable です。
 * - live Companyを直接変更せず、専用Callableへexact field updateを依頼します。
 *****************************************************************************/
export function useSiteShiftTypeOrderActions({
  type = Vue.ref(TYPE.ARRANGEMENT),
} = {}) {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();
  const companyStore = useCompanyStore();

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { updateCompanyArrangement } = useCompanyFunctions();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const internalType = Vue.isRef(type) ? type : Vue.ref(type);
  const isSaving = Vue.ref(false);
  const saveFailed = Vue.ref(false);

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const currentOrder = Vue.computed(() => {
    const field = FIELD_BY_TYPE[internalType.value];
    return field ? companyStore.company?.[field] || [] : [];
  });

  const canUpdate = Vue.computed(() => {
    const permission = PERMISSION_BY_TYPE[internalType.value];
    const user = auth.user;
    const isCompanyAdmin = user?.isAdmin === true;
    return (
      !!permission &&
      auth.isSuperUserClaimValid === true &&
      typeof auth.isSuperUser === "boolean" &&
      user?.isTemporary === false &&
      user?.disabled === false &&
      auth.companyId === companyStore.company?.docId &&
      (isCompanyAdmin ||
        (auth.isSuperUser === false && auth.hasPresetPermission(permission)))
    );
  });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 更新された現場オーダーを保存します。
   * live Companyは変更せず、成功後の購読反映に任せます。
   * @param {Array} newOrder 更新された現場オーダー配列
   */
  const update = async (newOrder) => {
    const field = FIELD_BY_TYPE[internalType.value];
    if (!field || !canUpdate.value) {
      throw new Error("表示順を更新する権限がありません。");
    }
    if (isSaving.value) {
      throw new Error("表示順を更新中です。");
    }
    if (!Array.isArray(newOrder)) {
      throw new Error("表示順の入力内容を確認してください。");
    }

    const order = newOrder.map(({ siteId, shiftType }) => ({
      siteId,
      shiftType,
    }));

    isSaving.value = true;
    saveFailed.value = false;
    try {
      return await updateCompanyArrangement(field, order);
    } catch (error) {
      saveFailed.value = true;
      throw error;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * 指定された現場勤務区分オーダーを削除します。
   * @param {string} orderKey 削除する現場勤務区分オーダーのキー
   */
  const remove = async (orderKey) => {
    const newOrder = currentOrder.value.filter(
      (order) => `${order.siteId}_${order.shiftType}` !== orderKey,
    );
    return await update(newOrder);
  };

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    canUpdate,
    currentOrder,
    isSaving,
    saveFailed,
    update,
    remove,
  };
}
