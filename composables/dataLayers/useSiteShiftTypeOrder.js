/*****************************************************************************
 * 現場稼働予定表示順序用データレイヤーコンポーザブル
 * - `useAuthStore` の `company` が持つ `siteOrder` または `scheduleOrder` を利用するためのコンポーザブルです。
 * - `type === 'arrangement'` で `company.siteOrder` を返します。
 * - `type === 'schedule'` で `company.scheduleOrder` を返します。
 * - 現場オーダー配列に含まれる現場データを `fetchSiteComposable` を使用してフェッチします。
 * - `schedules` が与えられると、その中に含まれる `orderKey` を確認し、現場オーダー配列に含まれないものを検出します。
 * - 検出された現場オーダーは `missingOrders` に格納され、`siteShiftTypeOrder` に追加されます。
 * - これにより、現場オーダー配列に存在しない現場オーダーもテーブルに表示できるようになります。
 *
 * [更新履歴]
 * 2026-06-08 - `remove` 関数を追加。
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetch } from "@/composables/fetch/useFetch";

/**
 * @param {*} options
 * @param {String|import("vue").Ref<String>} [options.type="arrangement"] 現場オーダーの種類 ("arrangement" または "schedule")
 * @param {Array} [options.schedules=[]] 現場稼働予定ドキュメント配列
 * @returns {Object} returns
 * @returns {Array} returns.siteShiftTypeOrder 現場オーダー配列
 * @returns {Object} returns.fetchSiteComposable 現場データフェッチ用コンポーザブル
 */
export function useSiteShiftTypeOrder({
  type = "arrangement",
  schedules = Vue.reactive([]),
} = {}) {
  /** SETUP STORES */
  const auth = useAuthStore();

  /** SETUP COMPOSABLES */
  const { fetchSiteComposable } = useFetch("useSiteShiftTypeOrder");
  // const fetchSiteComposable = providedFetchSiteComposable || useFetchSite();

  /** SETUP STATES */
  // type を ref として正規化
  const internalType = Vue.isRef(type) ? type : Vue.ref(type);
  const recalcMissingOrders = Vue.ref(true); // missingOrdersの再計算をトリガーするためのフラグ

  /**
   * `schedules` ドキュメント群から `orderKey` を抽出し、ユニークな `orderKey` のセットを保持します。
   */
  const uniqueOrderKeysInSchedules = Vue.ref(new Set());
  Vue.watch(
    schedules,
    (newSchedules) => {
      const newUniqueKeys = new Set();
      newSchedules.forEach((schedule) => {
        newUniqueKeys.add(schedule.orderKey); // orderKeyをセットに追加
      });
      uniqueOrderKeysInSchedules.value = newUniqueKeys; // 更新されたユニークorderKeyセットを保存
    },
    { immediate: true },
  );

  /**
   * `company` ドキュメントに登録されている現場オーダー配列を返します。
   * - コンポーザブルの引数 `type` によって返す値が変わります。
   * - `type === 'arrangement'` の場合は `auth.company.siteOrder` を返します。
   * - `type === 'schedule'` の場合は `auth.company.scheduleOrder` を返します。
   */
  const siteShiftTypeOrder = Vue.computed(() => {
    if (internalType.value === "arrangement") {
      return auth.company.siteOrder;
    }
    if (internalType.value === "schedule") {
      return auth.company.scheduleOrder;
    }
    return [];
  });

  /**
   * siteShiftTypeOrder に含まれる現場データをフェッチします。
   */
  Vue.watch(
    siteShiftTypeOrder,
    (newOrder) => {
      newOrder.forEach((order) => {
        fetchSiteComposable.fetchSite(order.siteId);
      });
    },
    { immediate: true, deep: true },
  );

  /** siteShiftTypeOrderに含まれるkeyのSet */
  const siteShiftTypeOrderKeys = Vue.computed(() => {
    return new Set(siteShiftTypeOrder.value.map((order) => order.key));
  });

  /**
   * `schedules` ドキュメント群に含まれる `orderKey` のうち、`siteShiftTypeOrder` に存在しないものを抽出して返します。
   */
  const missingOrders = Vue.computed(() => {
    const missing = [];

    if (recalcMissingOrders.value) {
      uniqueOrderKeysInSchedules.value.forEach((orderKey) => {
        if (!siteShiftTypeOrderKeys.value.has(orderKey)) {
          // orderKey から siteId と shiftType を抽出
          const lastUnderScoreIndex = orderKey.lastIndexOf("_");
          const siteId = orderKey.substring(0, lastUnderScoreIndex);
          const shiftType = orderKey.substring(lastUnderScoreIndex + 1);

          missing.push({ siteId, shiftType, key: orderKey });
        }
      });
    }

    return missing;
  });

  /** schedulesに含まれsiteShiftTypeOrderに含まれないものがあるか */
  const hasMissingOrder = Vue.computed(() => {
    return missingOrders.value.length > 0;
  });

  /**
   * siteShiftTypeOrderにmissingOrdersを追加した配列
   * - `siteShiftTypeOrder` に含まれない現場オーダーをテーブルに表示するために使用する。
   */
  const resolvedSiteShiftTypeOrder = Vue.computed(() => {
    return [...siteShiftTypeOrder.value, ...missingOrders.value];
  });

  /**
   * 更新された現場オーダーを保存します。
   * - `auth.company` の `siteOrder` または `scheduleOrder` を更新する直前、
   *   `recalcMissingOrders` を `false` に設定して、`missingOrders` の再計算を一時的に停止します。
   *   更新が完了したら `recalcMissingOrders` を `true` に設定して、`missingOrders` の再計算をトリガーします。
   *   これにより、`siteShiftTypeOrder` 内でのキーの重複を防止します。
   * @param {Array} newOrder 更新された現場オーダー配列
   */
  const update = async (newOrder) => {
    if (internalType.value === "arrangement") {
      auth.company.siteOrder = newOrder;
    }
    if (internalType.value === "schedule") {
      auth.company.scheduleOrder = newOrder;
    }

    try {
      recalcMissingOrders.value = false; // missingOrdersの再計算を一時的に停止
      await auth.company.update();
    } catch (error) {
      console.error("Failed to update site shift type order:", error);
    } finally {
      recalcMissingOrders.value = true; // missingOrdersの再計算をトリガー
    }
  };

  /**
   * 指定された現場オーダーを削除します。
   * @param {string} orderKey 削除する現場オーダーのキー
   */
  const remove = async (orderKey) => {
    const newOrder = siteShiftTypeOrder.value.filter(
      (order) => order.key !== orderKey,
    );
    await update(newOrder);
  };

  return {
    hasMissingOrder,
    missingOrders,
    siteShiftTypeOrder: resolvedSiteShiftTypeOrder,
    fetchSiteComposable, // 後方互換性のためにエクスポート

    update,
    remove,
  };
}
