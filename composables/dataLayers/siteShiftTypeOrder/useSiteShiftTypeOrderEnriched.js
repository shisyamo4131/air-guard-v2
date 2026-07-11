import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { SiteOrder } from "@/schemas";
import { useSiteShiftTypeOrder } from "@/composables/dataLayers/siteShiftTypeOrder/useSiteShiftTypeOrder";
import { TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

/*****************************************************************************
 * @file ./composables/dataLayers/siteShiftTypeOrder/useSiteShiftTypeOrderEnriched.js
 * @description
 * - `useSiteShiftTypeOrder` のラッパーコンポーザブル
 * - データ配列（例: SiteOperationSchedule）を受け取り、補完された現場勤務区分オーダーを提供します。
 * - 配置管理などで、`auth.company.siteOrder` や `auth.company.scheduleOrder` に
 *   未登録である現場勤務区分オーダーを表示対象とするためなどに使用します。
 * - 同時に、未登録である現場勤務区分オーダーの情報も提供します。
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<TYPE>} [options.type=TYPE.ARRANGEMENT] - 現場勤務区分オーダーの種類
 * @param {Ref<Array<Object>>} [options.enrichmentOrders=[]] - 補完対象の siteId, shiftType を含む要素の配列
 * @return {Object} - 補完された現場勤務区分オーダーと未登録オーダー情報を含むオブジェクト
 * @return {Ref<Array<Object>>} return.missingOrders - 未登録の現場勤務区分オーダーの配列
 * @return {Ref<boolean>} return.hasMissingOrders - 未登録の現場勤務区分オーダーが存在するかどうかのブール値
 * @return {Ref<Array<Object>>} return.siteShiftTypeOrder - 補完された現場勤務区分オーダーの配列
 *****************************************************************************/
export function useSiteShiftTypeOrderEnriched({
  type = Vue.ref(TYPE.ARRANGEMENT),
  enrichmentOrders = Vue.ref([]),
} = {}) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { fetchSiteComposable } = useFetch("useSiteShiftTypeOrderEnriched");
  const { fetchSite } = fetchSiteComposable;
  const { siteShiftTypeOrder } = useSiteShiftTypeOrder({ type });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const uniqueSiteShiftTypeOrderKeys = Vue.ref(new Set()); // siteShiftTypeOrderから抽出したユニークなorderKeyのセット
  const uniqueOrderKeysInEnrichmentOrders = Vue.ref(new Set()); // enrichmentOrdersから抽出したユニークなorderKeyのセット
  const enrichmentOrderByKey = Vue.ref(new Map()); // enrichmentOrdersをorderKeyでマップ化したもの

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * `siteShiftTypeOrder` から `orderKey` を抽出し、`uniqueSiteShiftTypeOrderKeys` を更新します。
   * - `siteShiftTypeOrder` が変更されるたびに、ユニークな `orderKey` のセットを再計算します。
   * - `siteShiftTypeOrder` に含まれる `siteId` に対応する現場データをフェッチします。
   */
  Vue.watch(
    siteShiftTypeOrder,
    (newOrder) => {
      const newUniqueKeys = new Set();
      newOrder.forEach((order) => {
        newUniqueKeys.add(order.key); // orderKeyをセットに追加
        fetchSite(order.siteId); // siteIdに対応する現場データをフェッチ
      });
      uniqueSiteShiftTypeOrderKeys.value = newUniqueKeys; // 更新されたユニークorderKeyセットを保存
    },
    { immediate: true, deep: true },
  );

  /**
   * `enrichmentOrders` から `orderKey` を抽出し、`uniqueOrderKeysInEnrichmentOrders` と `enrichmentOrderByKey` を更新します。
   * - `enrichmentOrders` が変更されるたびに、ユニークな `orderKey` のセットとマップを再計算します。
   * - `enrichmentOrders` に含まれる `siteId` に対応する現場データをフェッチします。
   */
  Vue.watch(
    enrichmentOrders,
    (newEnrichmentOrders) => {
      const newUniqueKeys = new Set();
      const newOrderByKey = new Map();
      newEnrichmentOrders.forEach(({ siteId, shiftType }) => {
        const order = new SiteOrder({ siteId, shiftType });
        newUniqueKeys.add(order.key); // orderKeyをセットに追加
        newOrderByKey.set(order.key, order);
        fetchSite(siteId); // siteIdに対応する現場データをフェッチ
      });
      uniqueOrderKeysInEnrichmentOrders.value = newUniqueKeys; // 更新されたユニークorderKeyセットを保存
      enrichmentOrderByKey.value = newOrderByKey; // 更新されたenrichmentOrdersのマップを保存
    },
    { immediate: true },
  );

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * `enrichmentOrders` に含まれるが、`siteShiftTypeOrder` に含まれない `order` オブジェクトの配列を返します。
   * - この計算は、`siteShiftTypeOrder` と `enrichmentOrders` の両方が変更されるたびに再評価されます。
   * @returns {Array<Object>} - 欠落している order オブジェクトの配列
   */
  const missingOrders = Vue.computed(() => {
    const missing = [];
    uniqueOrderKeysInEnrichmentOrders.value.forEach((orderKey) => {
      if (!uniqueSiteShiftTypeOrderKeys.value.has(orderKey)) {
        missing.push(enrichmentOrderByKey.value.get(orderKey));
      }
    });
    return missing;
  });

  /**
   * `missingOrders` が存在するかどうかを示すブール値を返します。
   * - `missingOrders` の長さが 0 より大きい場合は `true`、それ以外の場合は `false` を返します。
   * @returns {boolean} - 欠落している order が存在する場合は true、存在しない場合は false
   */
  const hasMissingOrders = Vue.computed(() => {
    return missingOrders.value.length > 0;
  });

  /**
   * `siteShiftTypeOrder` に `missingOrders` を追加した配列を返します。
   * - これにより、`siteShiftTypeOrder` と `enrichmentOrders` のどちらかに存在するすべての order を統合した配列を取得できます。
   * @returns {Array<Object>} - `siteShiftTypeOrder` と `missingOrders` を結合した配列
   */
  const resolvedSiteShiftTypeOrder = Vue.computed(() => {
    return [...siteShiftTypeOrder.value, ...missingOrders.value];
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    missingOrders,
    hasMissingOrders,
    siteShiftTypeOrder: resolvedSiteShiftTypeOrder,
  };
}
