import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";

export function useIndex(props, emit) {
  /*****************************************************************************
   * SETUP
   *****************************************************************************/
  const internalModelValue = Vue.ref(new SiteOperationSchedule());
  Vue.watch(
    () => props.schedule,
    (newVal) => {
      internalModelValue.value.initialize(newVal);
    },
    { immediate: true, deep: true },
  );

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function handleUpdateModelValue(newVal) {
    internalModelValue.value.initialize(newVal);

    // Optimistic update の為に internalModelValue を newVal で更新。
    // emit では newVal を渡す。
    // -> Optimistic Update の為に親への通知直前に `internalModelValue` を更新しているだけで、
    //    本来は `newVal` がそのまま emit されるべき。
    // -> また、`newVal` を emit しておけば親コンポーネント側でスケジュールインスタンスの
    //    `beforeUpdate` プロパティを参照することもできる。
    // emit("update:schedule", internalModelValue.value);
    emit("update:schedule", newVal);
  }

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * v-card-title のクラスを返します。
   */
  const titleClass = Vue.computed(() => {
    return ["d-flex", "text-subtitle-2", "font-weight-regular", "align-center"];
  });

  /**
   * ドラッグアイコンを表示するかどうかを返します。
   */
  const isDraggable = Vue.computed(() => {
    return props.schedule.isEditable && props.isDraggable;
  });

  /**
   * 開始終了時間の文字列を返します。
   */
  const timeLabel = Vue.computed(() => {
    return `${props.schedule.startTime} - ${props.schedule.endTime}`;
  });

  /**
   * 資格チップを表示するかどうかを返します。
   */
  const showQualificationChip = Vue.computed(() => {
    return props.schedule.qualificationRequired;
  });

  /**
   * デフォルトスロットのスロットプロパティを返します。
   */
  const defaultSlotProps = Vue.computed(() => {
    return {
      schedule: internalModelValue.value,
      model: {
        modelValue: internalModelValue.value,
        "onUpdate:modelValue": handleUpdateModelValue,
      },
    };
  });

  return {
    titleClass,
    isDraggable,
    timeLabel,
    showQualificationChip,
    defaultSlotProps,
  };
}
