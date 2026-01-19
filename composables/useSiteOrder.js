/*****************************************************************************
 * 現場オーダー用コンポーザブル
 * - `useAuthStore` の `compoany.siteOrder` を利用するためのコンポーザブル
 * - このコンポーザブルを介して利用することでマウント時に現場情報のフェッチを行う
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/**
 * @param {*} options
 * @param {Object} [options.fetchSiteComposable] 現場データフェッチ用コンポーザブル
 * @returns {Object} returns
 * @returns {Array} returns.siteOrder 現場オーダー配列
 * @returns {Object} returns.fetchSiteComposable 現場データフェッチ用コンポーザブル
 */
export function useSiteOrder({
  fetchSiteComposable: providedFetchSiteComposable = undefined,
}) {
  /** SETUP STORES */
  const auth = useAuthStore();

  /** SETUP COMPOSABLES */
  const fetchSiteComposable = providedFetchSiteComposable || useFetchSite();

  Vue.watch(
    () => auth.company.siteOrder,
    (newOrder) => {
      newOrder.forEach((order) => {
        fetchSiteComposable.fetchSite(order.siteId);
      });
    },
    { immediate: true },
  );

  return {
    siteOrder: Vue.computed(() => auth.company.siteOrder),
    fetchSiteComposable, // 後方互換性のためにエクスポート
  };
}
