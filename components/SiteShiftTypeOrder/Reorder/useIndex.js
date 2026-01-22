/*****************************************************************************
 * SiteShiftTypeOrderReorder 用コンポーザブル
 * - 現場オーダー管理のビジネスロジックを提供
 * - 都度更新ではなく、`Draft State Pattern` を採用するため、ユーザーによる更新の
 *   反映は `submit` イベントで処理する。
 *****************************************************************************/
import * as Vue from "vue";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { SiteOrder } from "@/schemas";

/**
 * @param {*} props
 * @param {*} emit
 * @returns {Object} - returns
 * @returns {Vue.Ref<SiteOrder[]>} items - 現場オーダーの配列
 * @returns {Vue.Ref<Boolean>} isChanged - internalItems が props.items と異なる場合に true
 * @returns {Function} submit - 現場オーダーの更新を行い、'submit' イベントを発火する関数
 * @returns {Function} cancel - 操作をキャンセルし、'cancel' イベントを発火する関数
 * @returns {Function} init - internalItems を props.items と同期する関数
 */
export function useIndex(props, emit) {
  /**
   * useFetchSite
   * 現場データを取得するためのコンポーザブル。props 経由で受け取るか、自前の useFetchSite を使用。
   */
  const fetchSiteComposable = props.fetchSiteComposable || useFetchSite();

  /**
   * internalItems
   * - コンポーネント内部で管理するモデル値
   * - `props.items` の変更を監視し、変更時には `initInternalModelValue` を呼び出して同期
   */
  const internalItems = Vue.ref([]);

  /**
   * isChanged
   * - internalItems が props.items と異なる場合に true
   */
  const isChanged = Vue.computed(() => {
    if (internalItems.value.length !== props.items.length) {
      return true;
    }
    for (let i = 0; i < internalItems.value.length; i++) {
      if (internalItems.value[i].key !== props.items[i].key) {
        return true;
      }
    }
    return false;
  });

  /**
   * internalItems を props.items と同期します。
   * - 同期時には SiteOrder インスタンスに変換し、関連する現場データを取得します。
   */
  function init() {
    internalItems.value = props.items.map((v) => {
      fetchSiteComposable.fetchSite(v.siteId);
      return new SiteOrder(v);
    });
  }

  /**
   * props.items の変更を監視し、変更時に internalItems を初期化します。
   */
  Vue.watch(() => props.items, init, { immediate: true, deep: true });

  /**
   * 現場オーダーを更新し、'submit' イベントを発火します。
   */
  async function submit() {
    emit("submit", internalItems.value);
  }

  /**
   * 操作をキャンセルし、'cancel' イベントを発火します。
   */
  function cancel() {
    init();
    emit("cancel");
  }

  return {
    items: internalItems,
    isChanged,
    submit,
    cancel,
    init,
  };
}
