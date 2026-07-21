/*****************************************************************************
 * @file ./composables/dataLayers/employee/useEmployeesResigned.js
 * @description 退職者検索用 データレイヤーコンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { Employee } from "@/schemas";

/**
 * @param {{ search: import('vue').Ref<string|null> }} options
 * @returns {{ docs: import('vue').Ref<Array<Object>> }}
 */
export function useEmployeesResigned({ search }) {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new Employee());
  const docs = Vue.ref([]);

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  async function fetch() {
    if (!Vue.unref(search)) {
      docs.value = [];
      return;
    }
    docs.value = await instance.fetchDocs({
      constraints: search.value,
      options: [["where", "employmentStatus", "==", "RESIGNED"]],
    });
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(search, fetch, { immediate: true });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return { docs };
}
