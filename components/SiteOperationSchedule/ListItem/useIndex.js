import * as Vue from "vue";

export function useIndex(props) {
  /** title */
  const title = Vue.computed(() => {
    return props.modelValue.workDescription || "通常警備";
  });

  /** 要資格アイコンを表示するかどうか */
  const showQualificationIcon = Vue.computed(() => {
    return props.modelValue.qualificationRequired;
  });

  /** 必要人員数 */
  const requiredPersonnel = Vue.computed(() => {
    return props.modelValue.requiredPersonnel ?? 0;
  });

  /** 時間 */
  const time = Vue.computed(() => {
    const start = props.modelValue.startTime;
    const end = props.modelValue.endTime;
    return `${start} 〜 ${end}`;
  });

  return {
    title,
    showQualificationIcon,
    requiredPersonnel,
    time,
  };
}
