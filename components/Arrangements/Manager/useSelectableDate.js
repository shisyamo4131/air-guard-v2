import * as Vue from "vue";
/*****************************************************************************
 * @file ./components/Arrangements/Manager/useSelectableDate.js
 * @description
 * - 選択中の日付を管理する composable
 * - 選択済みの日付を再度選択した場合は null に戻す
 *
 * @note
 * - 選択中の日付を管理するためのシンプルなコンポーザブル
 * - 現在は ArrangementsManager 専用であるが、将来的に汎用コンポーザブルにする可能性あり。
 *****************************************************************************/
export function useSelectableDate(initialValue = null) {
  const internalValue = Vue.ref(initialValue);

  const selectedDate = Vue.computed({
    get() {
      return internalValue.value;
    },
    set(value) {
      internalValue.value = value === internalValue.value ? null : value;
    },
  });

  return { selectedDate };
}
