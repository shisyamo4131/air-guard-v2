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
    emit("update:schedule", internalModelValue.value);
  }

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * v-card-title のクラスを返します。
   */
  const titleClass = Vue.computed(() => {
    return ["d-flex", "text-subtitle-1", "font-weight-regular", "align-center"];
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
   * デフォルトスロットのスロットプロパティを返します。
   */
  const defaultSlotProps = Vue.computed(() => {
    return {
      modelValue: internalModelValue.value,
      "onUpdate:modelValue": handleUpdateModelValue,
    };
  });

  return {
    titleClass,
    isDraggable,
    timeLabel,
    defaultSlotProps,
  };
}
