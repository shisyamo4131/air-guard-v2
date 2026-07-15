import * as Vue from "vue";

/*****************************************************************************
 * @file ./components/SiteOperationSchedule/Worker/Tag/useIndex.js
 * @description SiteOperationScheduleWorkerTag コンポーネントのロジックを管理する専用コンポーザブル。
 *
 * [更新履歴]
 * 2026-06-10 - `props.notification` の開始時刻と終了時刻を優先使用するように修正。
 *              伴って、開始時刻・終了時刻の強調表示判定ロジックも修正。
 *****************************************************************************/
export function useIndex(props, emit) {
  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * times
   * - タグに表示する開始時刻と終了時刻を返します。
   * - `props.notification` が存在する場合は、`actualStartTime` と `actualEndTime` を優先使用します。
   * - 存在しない場合は、`props.worker.startTime` と `props.worker.endTime` を使用します。
   */
  const times = Vue.computed(() => {
    const startTime =
      props.notification?.actualStartTime || props.worker.startTime;
    const endTime = props.notification?.actualEndTime || props.worker.endTime;
    return { startTime, endTime };
  });

  /**
   * 開始時刻と終了時刻がスケジュールの開始時刻と終了時刻と異なるかどうかを判定
   * - `times` と `props.schedule` の開始時刻と終了時刻を比較して、どちらかが異なる場合に `true` を返します。
   * - これにより、タグの表示を強調するかどうかを制御できます。
   */
  const isTimesHasDifference = Vue.computed(() => {
    const scheduleStartTime = props.schedule.startTime;
    const scheduleEndTime = props.schedule.endTime;
    const startTime = times.value.startTime;
    const endTime = times.value.endTime;
    return {
      startTime: scheduleStartTime !== startTime,
      endTime: scheduleEndTime !== endTime,
    };
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   * - WorkerTag との契約に基づいたプロパティを返します。
   * - `removable` 属性は `props.removable` と `props.schedule.isEditable` の両方が `true` の場合にのみ有効化する
   */
  const attrs = Vue.computed(() => {
    const {
      disableEdit,
      disableNotification,
      editIcon,
      hideEdit,
      hideNotification,
      notification,
      schedule,
      worker,
      ...rest
    } = props;
    const scheduleIsEditable = props.schedule?.isEditable || false;
    const workerId = worker.workerId;
    const isEmployee = worker.isEmployee;
    const onClickRemove = () => emit("click:remove", { workerId, isEmployee });
    return {
      ...rest,
      id: worker.id,
      startTime: times.value.startTime,
      endTime: times.value.endTime,
      isEmployee: worker.isEmployee,
      highlightStartTime: isTimesHasDifference.value.startTime,
      highlightEndTime: isTimesHasDifference.value.endTime,
      removable: props.removable && scheduleIsEditable,
      isDraggable: props.isDraggable && scheduleIsEditable,
      "onClick:remove": onClickRemove,
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
    const notification = props.notification || null;
    const result = {
      disabled: !scheduleIsEditable || props.disableNotification,
      notification,
    };
    if (notification) {
      result.onClick = () => emit("click:notification", notification);
    }
    return result;
  });

  return { attrs, editProps, notificationProps };
}
