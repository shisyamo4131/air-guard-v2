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
import { employeeReadLabel } from "@/composables/domain/employee/employeeReadLabel";

export function useIndex(props, emit) {
  const { fetchEmployeeComposable } = useFetch("EmployeeTag");
  const { fetchEmployee, cachedEmployees, scope, getStatus } = fetchEmployeeComposable;

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(() => [props.docId, scope?.value], () => fetchEmployee(props.docId), { immediate: true });

  // cachedEmployeesから従業員情報のdisplayNameを取得
  const label = Vue.computed(() => {
    const employee = cachedEmployees.value[props.docId];
    return employeeReadLabel(props.docId ? getStatus(props.docId) : "idle", employee?.displayName);
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   * - 終端状態は固定文言で表示し、実際の取得中だけローディングにする。
   */
  const attrs = Vue.computed(() => {
    return {
      ...props,
      label: label.value,
      loading: !!props.docId && getStatus(props.docId) === "loading",
      "onClick:remove": () => emit("click:remove"),
    };
  });

  return { attrs };
}
