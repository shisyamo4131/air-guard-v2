/*****************************************************************************
 * 現場稼働予定ドキュメント取得用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

/**
 * @param {*} options
 * @param {Ref<string|null>} [options.search=null] - Search string for N-gram token search. If null or shorter than `minSearchLength`, no search is performed.
 * @param {Ref<Array>} [options.options=[]] - Additional query options (e.g., orderBy, limit) when performing search.
 * @param {number} [options.minSearchLength=2] - Minimum length of `search` string to trigger search.
 * @param {boolean} [options.fetchAllOnEmpty=false] - If true, fetch all documents when `search` is null or empty.
 * @returns {Object} - An object containing the reactive `docs` array and `groupedDocs` map.
 * @returns {Ref<Array>} returns.docs - 現場稼働予定ドキュメント配列
 * @returns {Ref<Map>} returns.groupedDocs - groupKey でグループ化したドキュメントのマップ
 */
export function useSiteOperationSchedules({
  search = Vue.ref(null),
  options = Vue.ref([]),
  minSearchLength = 2,
  fetchAllOnEmpty = false,
} = {}) {
  const { docs } = useDocuments("SiteOperationSchedule", {
    search,
    options,
    minSearchLength,
    fetchAllOnEmpty,
  });

  /** groupKey でグループ化したドキュメントのマップ */
  const groupedDocs = Vue.computed(() => {
    const result = new Map();
    docs.forEach((schedule) => {
      if (!result.has(schedule.groupKey)) {
        result.set(schedule.groupKey, {
          total: schedule.requiredPersonnel,
          count: 1,
          schedules: [schedule],
          hasMultiple: false,
        });
      } else {
        const existing = result.get(schedule.groupKey);
        existing.total += schedule.requiredPersonnel;
        existing.count += 1;
        existing.schedules.push(schedule);
        existing.hasMultiple = existing.count > 1;
        result.set(schedule.groupKey, existing);
      }
    });
    return result;
  });

  return { docs, groupedDocs };
}
