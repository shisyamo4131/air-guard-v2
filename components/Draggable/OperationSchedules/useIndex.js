import * as Vue from "vue";
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

export function useIndex(props, emit) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { logger, isDev } = useBaseManager("DraggableOperationSchedules");

  /*****************************************************************************
   * SETUP STATES
   *****************************************************************************/
  // 内部管理用の schedule オブジェクト配列
  const internalSchedules = Vue.ref(props.schedules || []);
  Vue.watch(
    () => props.schedules,
    (newSchedules) => {
      internalSchedules.value = newSchedules.map(
        (s) => new SiteOperationSchedule(s),
      );
      internalSchedules.value.sort((a, b) => a.displayOrder - b.displayOrder);
    },
    { immediate: true, deep: true },
  );

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 引数で受け取った新しいスケジュール配列を元に、siteId, shiftType, dateAt, displayOrder を更新し、
   * 内部状態を更新した後、親コンポーネントに更新を通知します。
   * - ドラッグアンドドロップによるスケジュールの順序変更や、他のグループからのスケジュールの移動など、
   *   スケジュール配列が変更された際に呼び出されます。
   * - 他のグループからのスケジュールの移動の場合、siteId, shiftType, dateAt が移動元の値のままであるため
   *   これらを props から取得して更新します。
   * - 順序変更の場合は displayOrder を新しい配列のインデックスに基づいて更新します。
   * @param {Array} newSchedules - ドラッグアンドドロップ後の新しいスケジュール配列
   * @returns {Promise<void>}
   */
  async function handleUpdateModelValue(newSchedules) {
    // ログ出力（開発環境のみ）
    if (isDev) {
      logger.info({
        message: "Updating schedules with new schedules",
        data: newSchedules,
      });
    }

    // siteId, shiftType, date, displayOrder を更新
    newSchedules.forEach((schedule, index) => {
      schedule.siteId = props.siteId;
      schedule.shiftType = props.shiftType;
      schedule.dateAt = dayjs // 実行環境に依存せず Asia/Tokyo として扱う
        .tz(props.date, "Asia/Tokyo")
        .startOf("day")
        .toDate();
      schedule.displayOrder = index;
    });

    // 内部状態を更新（Optimistic Updates）
    internalSchedules.value = newSchedules;

    // 親コンポーネントに更新を通知
    emit("update:schedules", newSchedules);
  }

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  // draggable コンポーネントに渡す属性
  const attrs = Vue.computed(() => {
    return {
      disabled: props.disabled,
      group: { name: props.groupName },
      handle: props.handle,
      itemKey: props.itemKey,
      modelValue: internalSchedules.value,
      "onUpdate:modelValue": handleUpdateModelValue,

      // 以下、スマホやタブレット端末においてドラッグ中の要素をPCと同様に取り扱うための追加設定
      // この設定を行わないと、ドラッグ中の要素が親コンテナの描画範囲からはみ出ないなどの問題が発生する
      ghostClass: "sortable-ghost",
      forceFallback: true,
      fallbackOnBody: true,
      appendTo: "body",
    };
  });

  // デフォルトスロットに渡すプロパティ
  const defaultSlotProps = Vue.computed(() => {
    return {
      isDraggable: !props.disabled,
      removable: !props.disabled,
    };
  });

  return {
    attrs,
    defaultSlotProps,
  };
}
