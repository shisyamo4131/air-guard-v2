/*****************************************************************************
 * OutsourcerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  const { fetchOutsourcer, cachedOutsourcers } =
    props.fetchOutsourcerComposable;

  // docIdが変更されたら外注先情報を取得
  Vue.watch(
    () => props.docId,
    (newOutsourcerId) => {
      if (newOutsourcerId) {
        fetchOutsourcer([newOutsourcerId]);
      }
    },
    { immediate: true },
  );

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
