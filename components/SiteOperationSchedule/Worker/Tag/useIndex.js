/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  /**
   * 開始時刻がスケジュールの開始時刻と異なる場合に色を変えるためのクラスを返す
   */
  const startTimeClass = Vue.computed(() => {
    return {
      ["text-red"]: props.schedule.startTime !== props.worker.startTime,
    };
  });

  /**
   * 終了時刻がスケジュールの終了時刻と異なる場合に色を変えるためのクラスを返す
   */
  const endTimeClass = Vue.computed(() => {
    return {
      ["text-red"]: props.schedule.endTime !== props.worker.endTime,
    };
  });

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

  return { attrs, startTimeClass, endTimeClass };
}
