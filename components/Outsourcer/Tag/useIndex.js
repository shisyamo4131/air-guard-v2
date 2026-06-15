/*****************************************************************************
 * @file ./components/Outsourcer/Tag/useIndex.js
 * @description OutsourcerTag 専用コンポーザブル
 *
 * [更新履歴]
 * 2026-06-15 - `fetchOutsourcerComposable` を `useFetch` から取得するように変更
 *            - `docId` のウォッチャーをリファクタリング
 *****************************************************************************/
import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";

export function useIndex(props, emit) {
  const { fetchOutsourcerComposable } = useFetch("OutsourcerTag");
  const { fetchOutsourcer, cachedOutsourcers } = fetchOutsourcerComposable;

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(() => props.docId, fetchOutsourcer, { immediate: true });

  // cachedOutsourcersから外注先情報のdisplayNameを取得
  const label = Vue.computed(() => {
    if (!props.docId) return undefined;
    const outsourcer = cachedOutsourcers.value[props.docId];
    return outsourcer?.displayName;
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   * - label が undefined の場合、Tag コンポーネントが自動的にローディング状態になる
   */
  const attrs = Vue.computed(() => {
    return {
      ...props,
      label: label.value,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  return { attrs };
}
