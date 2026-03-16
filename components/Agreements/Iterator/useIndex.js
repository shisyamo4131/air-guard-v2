/*****************************************************************************
 * @file ./components/Agreements/Iterator/useIndex.js
 * @description AgreementsIterator 専用コンポーザブル
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Agreement } from "@/schemas";

export function useIndex(props, emit) {
  const internalItems = Vue.ref([]);
  const internalShiftType = Vue.ref(props.shiftType);

  /**
   * props.shiftType が変更されたときに internalShiftType を更新するウォッチャー
   */
  Vue.watch(
    () => props.shiftType,
    (newShiftType) => (internalShiftType.value = newShiftType),
  );

  /**
   * internalShiftType が変更されたときに `update:shift-type` イベントを発火するウォッチャー
   */
  Vue.watch(internalShiftType, (newShiftType) =>
    emit("update:shift-type", newShiftType),
  );

  /**
   * 比較関数: date の降順（優先）、その次に dayType の順序でソート
   * @param {Object} a
   * @param {Object} b
   * @returns {number} ソート順序を示す数値
   */
  const compareFn = (a, b) => {
    // 1. date の降順でソート
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;

    // 2. shiftType の昇順でソート
    const shiftTypeA = Agreement.SHIFT_TYPE[a.shiftType]?.order || 0;
    const shiftTypeB = Agreement.SHIFT_TYPE[b.shiftType]?.order || 0;
    if (shiftTypeA < shiftTypeB) return -1;
    if (shiftTypeA > shiftTypeB) return 1;

    // 3. date が同じ場合、dayType の昇順でソート
    const dayTypeA = Agreement.DAY_TYPE[a.dayType]?.order || 0;
    const dayTypeB = Agreement.DAY_TYPE[b.dayType]?.order || 0;
    if (dayTypeA < dayTypeB) return -1;
    if (dayTypeA > dayTypeB) return 1;
    return 0;
  };

  /**
   * props.agreements が変更されるたびに、internalShiftType に基づいたフィルタリングと
   * 曜日区分に基づいたソートを行い、internalItems にセットする
   */
  Vue.watchEffect(() => {
    // agreements を dayType でソートして internalItems にセット
    internalItems.value = props.agreements
      .filter(({ shiftType }) => {
        if (internalShiftType.value === "ALL") return true;
        return shiftType === internalShiftType.value;
      })
      .sort(compareFn);
  });

  /**
   * 勤務区分を設定する関数
   * @param {String} value - 設定する勤務区分の値
   * @returns {void}
   */
  const setShiftType = (value) => {
    const applicables = ["ALL", ...Object.keys(Agreement.SHIFT_TYPE)];
    if (!applicables.includes(value)) {
      console.warn(
        `Invalid shift type: ${value}. Applicable values are: ${applicables.join(", ")}`,
      );
      return;
    }
    internalShiftType.value = value;
  };

  /**
   * v-data-iterator の modelValue として使用する computed プロパティ
   * props.modelValue が配列であればそのまま使用し、そうでなければ配列に変換して使用する
   * セレクト戦略が "single" の場合は、配列の最初の要素を modelValue として emit する
   * @returns {Array} v-data-iterator に渡す modelValue
   */
  const modelValue = computed({
    get() {
      return Array.isArray(props.modelValue)
        ? props.modelValue
        : [props.modelValue];
    },
    set(v) {
      const returnValue = props.selectStrategy === "single" ? v[0] || null : v;
      emit("update:modelValue", returnValue);
    },
  });

  return {
    modelValue,

    // フィルタリングとソートを行った取極め情報の配列
    agreements: internalItems,

    // 選択された勤務区分
    shiftType: internalShiftType,

    // 表示されているアイテムの総数
    length: Vue.computed(() => internalItems.value.length),

    // 勤務区分を設定する関数
    setShiftType,
  };
}
