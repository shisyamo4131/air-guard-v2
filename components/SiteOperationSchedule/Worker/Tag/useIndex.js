/*****************************************************************************
 * SiteOperationScheduleWorkerTag 専用コンポーザブル
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
   * - `worker`、`schedule`、`notifications` プロパティは除外して渡す
   * - `removable` 属性は `props.removable` と `props.schedule.isEditable` の両方が `true` の場合にのみ有効化する
   */
  const attrs = Vue.computed(() => {
    const { worker, schedule, notifications, ...rest } = props;
    const scheduleIsEditable = props.schedule?.isEditable || false;
    return {
      ...rest,
      id: worker.id,
      startTime: worker.startTime,
      endTime: worker.endTime,
      isEmployee: worker.isEmployee,
      highlightStartTime: isStartTimeModified.value,
      highlightEndTime: isEndTimeModified.value,
      removable: props.removable && scheduleIsEditable,
      showDraggableIcon: props.showDraggableIcon && scheduleIsEditable,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  /**
   * 編集アイコンに渡すプロパティの算出
   * - `props.schedule.isEditable` が `false` の場合、自動的に無効化されます。
   */
  const editProps = Vue.computed(() => {
    const scheduleIsEditable = props.schedule?.isEditable || false;
    return {
      disabled: !scheduleIsEditable || props.disableEdit,
      icon: props.editIcon,
      size: "small",
      onClick: () => emit("click:edit"),
    };
  });

  /**
   * `notification` スロットに渡すプロパティの算出
   * - `props.schedule.isEditable` が `false` の場合、自動的に無効化されます。
   */
  const notificationProps = Vue.computed(() => {
    const scheduleIsEditable = props.schedule?.isEditable || false;
    const result = {
      disabled: !scheduleIsEditable || props.disableNotification,
      notification: notification.value,
    };
    if (notification.value) {
      result.onClick = () => emit("click:notification");
    }
    return result;
  });

  return { attrs, editProps, notificationProps };
}
