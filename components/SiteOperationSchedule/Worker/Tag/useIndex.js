/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  /**
   * Tag コンポーネントに渡す属性の算出
   */
  const attrs = Vue.computed(() => {
    const { worker, ...rest } = props;
    return {
      ...rest,
      id: worker.id,
      startTime: worker.startTime,
      endTime: worker.endTime,
      isEmployee: worker.isEmployee,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  return { attrs };
}
