/*****************************************************************************
 * 現場稼働予定表示順序用コンポーザブル
 * - `useAuthStore` の `company` が持つ `siteOrder` または `scheduleOrder` を利用するためのコンポーザブルです。
 * - `type === 'arrangement'` で `company.siteOrder` を返します。
 * - `type === 'schedule'` で `company.scheduleOrder` を返します。
 * - 現場オーダー配列に含まれる現場データを `fetchSiteComposable` を使用してフェッチします。
 * - `schedules` が与えられると、その中に含まれる `orderKey` を確認し、現場オーダー配列に含まれないものを検出します。
 * - 検出された現場オーダーは `missingOrders` に格納され、`siteShiftTypeOrder` に追加されます。
 * - これにより、現場オーダー配列に存在しない現場オーダーもテーブルに表示できるようになります。
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/**
 * @param {*} options
 * @param {String} [options.type="arrangement"] 現場オーダーの種類 ("arrangement" または "schedule")
 * @param {Array} [options.schedules=[]] 現場稼働予定ドキュメント配列
 * @param {Object} [options.fetchSiteComposable] 現場データフェッチ用コンポーザブル
 * @returns {Object} returns
 * @returns {Array} returns.siteShiftTypeOrder 現場オーダー配列
 * @returns {Object} returns.fetchSiteComposable 現場データフェッチ用コンポーザブル
 */
export function useSiteShiftTypeOrder({
  type = "arrangement",
  schedules = Vue.reactive([]),
  fetchSiteComposable: providedFetchSiteComposable = undefined,
}) {
  /** SETUP STORES */
  const auth = useAuthStore();

  /** SETUP COMPOSABLES */
  const fetchSiteComposable = providedFetchSiteComposable || useFetchSite();

  /** SETUP STATES */
  const uniqueOrderKeysInSchedules = Vue.ref(new Set()); // schedules内のユニークなorderKeyセット
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
   * 現場オーダー配列
   * - type によって `company.siteOrder` または `company.scheduleOrder` を返す
   */
  const siteShiftTypeOrder = Vue.computed(() => {
    if (type === "arrangement") {
      return auth.company.siteOrder;
    }
    if (type === "schedule") {
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

  /** schedulesに含まれるがsiteShiftTypeOrderに含まれないorderKeyの配列 */
  const missingOrders = Vue.computed(() => {
    const missing = [];

    uniqueOrderKeysInSchedules.value.forEach((orderKey) => {
      if (!siteShiftTypeOrderKeys.value.has(orderKey)) {
        // orderKey から siteId と shiftType を抽出
        const lastHyphenIndex = orderKey.lastIndexOf("-");
        const siteId = orderKey.substring(0, lastHyphenIndex);
        const shiftType = orderKey.substring(lastHyphenIndex + 1);

        missing.push({
          siteId,
          shiftType,
          key: orderKey,
        });
      }
    });

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

  return {
    hasMissingOrder,
    missingOrders,
    siteShiftTypeOrder: resolvedSiteShiftTypeOrder,
    fetchSiteComposable, // 後方互換性のためにエクスポート
  };
}
