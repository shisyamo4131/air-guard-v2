/*****************************************************************************
 * EmployeeTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  const { fetchEmployee, cachedEmployees } = props.fetchEmployeeComposable;

  // docIdが変更されたら従業員情報を取得
  Vue.watch(
    () => props.docId,
    (newEmployeeId) => {
      if (newEmployeeId) {
        fetchEmployee([newEmployeeId]);
      }
    },
    { immediate: true },
  );

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
