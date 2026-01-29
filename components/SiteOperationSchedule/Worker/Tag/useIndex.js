/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  /**
   * Tag コンポーネントに渡す属性の算出
   */
  const attrs = Vue.computed(() => {
    return {
      ...props,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  return { attrs };
}
