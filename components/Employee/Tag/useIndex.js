/*****************************************************************************
 * @file ./components/Employee/Tag/useIndex.js
 * @description EmployeeTag 専用コンポーザブル
 *
 * [更新履歴]
 * 2026-06-15 - `fetchEmployeeComposable` を `useFetch` から取得するように変更
 *            - `docId` のウォッチャーをリファクタリング
 *****************************************************************************/
import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";

export function useIndex(props, emit) {
  const { fetchEmployeeComposable } = useFetch("EmployeeTag");
  const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(() => props.docId, fetchEmployee, { immediate: true });

  // cachedEmployeesから従業員情報のdisplayNameを取得
  const label = Vue.computed(() => {
    if (!props.docId) return undefined;
    const employee = cachedEmployees.value[props.docId];
    return employee?.displayName;
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   * - label が undefined の場合、Tag コンポーネントが自動的にローディング状態になる
   */
  const attrs = Vue.computed(() => {
    return {
      ...props,
      label: label.value,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  return { attrs };
}
