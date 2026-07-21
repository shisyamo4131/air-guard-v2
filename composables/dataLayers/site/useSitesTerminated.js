/*****************************************************************************
 * @file ./composables/dataLayers/site/useSitesTerminated.js
 * @description 終了現場検索用 データレイヤーコンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";

/**
 * @param {{ search: import('vue').Ref<string|null> }} options
 * @returns {{ docs: import('vue').Ref<Array<Object>> }}
 */
export function useSitesTerminated({ search }) {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new Site());
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
      constraints: Vue.unref(search),
      options: [["where", "status", "==", Site.STATUS_TERMINATED]],
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
