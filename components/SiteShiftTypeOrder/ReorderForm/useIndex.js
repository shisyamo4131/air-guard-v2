/*****************************************************************************
 * @file ./components/SiteShiftTypeOrder/ReorderForm/useIndex.js
 * @description SiteShiftTypeOrderReorderForm 用コンポーザブル
 * - 現場勤務区分オーダーのビジネスロジックを提供
 * - 都度更新ではなく、`Draft State Pattern` を採用するため、ユーザーによる更新の
 *   反映は `submit` イベントで処理する。
 *****************************************************************************/
import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { SiteOrder } from "@/schemas";

/*****************************************************************************
 * @param {*} props
 * @param {*} emit
 * @returns {Object} - returns
 * @returns {Vue.Ref<SiteOrder[]>} items - 現場勤務区分オーダーの配列
 * @returns {Vue.Ref<Boolean>} isChanged - internalItems が props.siteShiftTypeOrder と異なる場合に true
 * @returns {Function} submit - 現場勤務区分オーダーの更新を行い、'submit' イベントを発火する関数
 * @returns {Function} cancel - 操作をキャンセルし、'cancel' イベントを発火する関数
 * @returns {Function} init - internalItems を props.siteShiftTypeOrder と同期する関数
 *****************************************************************************/
export function useIndex(props, emit) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  /** FETCH SITE */
  const { fetchSiteComposable } = useFetch("SiteShiftTypeOrderReorderForm");
  const { fetchSite } = fetchSiteComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  /**
   * internalItems
   * - コンポーネント内部で管理するモデル値
   * - `props.siteShiftTypeOrder` の変更を監視し、変更時には `init` を呼び出して同期
   */
  const internalItems = Vue.ref([]);

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * internalItems を props.siteShiftTypeOrder と同期します。
   * - 同期時には SiteOrder インスタンスに変換し、関連する現場データを取得します。
   */
  function init() {
    internalItems.value = props.siteShiftTypeOrder.map((v) => {
      fetchSite(v.siteId);
      return new SiteOrder(v);
    });
  }

  /**
   * 現場オーダーを更新し、'submit' イベントを発火します。
   */
  async function submit() {
    emit("submit", internalItems.value);
  }

  /**
   * - `init` 関数を呼び出して `internalItems` を `props.siteShiftTypeOrder` と同期します。
   * - 'cancel' イベントを発火します。
   */
  function cancel() {
    init();
    emit("cancel");
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * props.siteShiftTypeOrder の変更を監視し、`init` 関数を呼び出します。
   */
  Vue.watch(() => props.siteShiftTypeOrder, init, {
    immediate: true,
    deep: true,
  });

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * isChanged
   * - internalItems が props.siteShiftTypeOrder と異なる場合に true
   */
  const isChanged = Vue.computed(() => {
    if (internalItems.value.length !== props.siteShiftTypeOrder.length) {
      return true;
    }
    for (let i = 0; i < internalItems.value.length; i++) {
      if (internalItems.value[i].key !== props.siteShiftTypeOrder[i].key) {
        return true;
      }
    }
    return false;
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    items: internalItems,
    isChanged,
    submit,
    cancel,
    init,
  };
}
