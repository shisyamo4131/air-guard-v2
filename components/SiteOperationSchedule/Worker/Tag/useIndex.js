/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  /**
   * 開始時刻がスケジュールの開始時刻と異なるかどうかを判定
   */
  const isStartTimeModified = Vue.computed(() => {
    return props.schedule.startTime !== props.worker.startTime;
  });

  /**
   * 終了時刻がスケジュールの終了時刻と異なるかどうかを判定
   */
  const isEndTimeModified = Vue.computed(() => {
    return props.schedule.endTime !== props.worker.endTime;
  });

  /**
   * 配置通知オブジェクトから通知オブジェクトを取得して返す
   */
  const notification = Vue.computed(() => {
    return props.notifications?.[props.worker.notificationKey] || null;
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   */
  const attrs = Vue.computed(() => {
    const { worker, schedule, notifications, ...rest } = props;
    return {
      ...rest,
      id: worker.id,
      startTime: worker.startTime,
      endTime: worker.endTime,
      isEmployee: worker.isEmployee,
      highlightStartTime: isStartTimeModified.value,
      highlightEndTime: isEndTimeModified.value,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  /**
   * `notification` スロットに渡すプロパティの算出
   */
  const notificationSlotProps = Vue.computed(() => {
    const result = {
      notification: notification.value,
    };
    if (notification.value) {
      result.onClick = () => emit("click:notification");
    }
    return result;
  });

  return { attrs, notificationSlotProps };
}
