/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";

export function useIndex(props, emit) {
  // useFetchEmployeeのインスタンス取得（propsで渡されたものか、新規作成）
  const fetchEmployeeComposable =
    props.fetchEmployeeComposable || useFetchEmployee();

  const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;

  // workerIdが変更されたら従業員情報を取得
  Vue.watch(
    () => props.workerId,
    (newWorkerId) => {
      if (newWorkerId) {
        fetchEmployee([newWorkerId]);
      }
    },
    { immediate: true },
  );

  // cachedEmployeesから従業員情報のdisplayNameを取得
  const employeeLabel = Vue.computed(() => {
    if (!props.workerId) return undefined;
    const employee = cachedEmployees.value[props.workerId];
    return employee?.displayName;
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   * - label が undefined の場合、Tag コンポーネントが自動的にローディング状態になる
   */
  const attrs = Vue.computed(() => {
    return {
      ...props,
      label: employeeLabel.value,
      "onClick:remove": () => emit("click:remove"),
    };
  });

  return { attrs };
}
