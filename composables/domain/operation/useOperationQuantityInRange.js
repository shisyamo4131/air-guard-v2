/*****************************************************************************
 * @file ./composables/useOperationQuantityInRange.js
 *****************************************************************************/
import * as Vue from "vue";

/*****************************************************************************
 * @function useOperationQuantityInRange
 * @description 日付ごとの稼働数を計算するためのコンポーザブル
 * - `daysInRangeMap` に含まれる日付の範囲に対して、`schedules` と `operations` の情報をもとに稼働数を計算して返します。
 * - `schedules` は SiteOperationSchedule の配列で、`requiredPersonnel` が使用されます。
 * - `operations` は OperationResult の配列で、`statistics?.total?.quantity` が使用されます。
 * - SiteOperationSchedule をベースに作成された OperationResult は同一の docId を有することを利用して
 *   OperationResult の情報が優先されるようにしています。
 * @param {Object} options - オプションオブジェクト
 * @param {Vue.Ref<Array<SiteOperationSchedule>>} options.schedules - SiteOperationSchedule の配列を保持する参照
 * @param {Vue.Ref<Array<OperationResult>>} options.operations - OperationResult の配列を保持する参照
 * @param {Vue.Ref<Map<string, any>>} options.daysInRangeMap - 日付の範囲を保持する Map の参照
 * @returns {Vue.ComputedRef<Map<string, number>>} 日付ごとの稼働数を返す計算済みの参照
 *****************************************************************************/
export function useOperationQuantityInRange({
  schedules,
  operations,
  daysInRangeMap,
} = {}) {
  return Vue.computed(() => {
    const result = new Map();
    const operationMapByDate = new Map();

    // {date: Map<docId, quantity>} を SiteOperationSchedule から作成
    // quantity には requiredPersonnel を使用する
    for (const schedule of Vue.unref(schedules)) {
      const map = operationMapByDate.get(schedule.date) ?? new Map();
      map.set(schedule.docId, schedule.requiredPersonnel ?? 0);
      operationMapByDate.set(schedule.date, map);
    }

    // {date: Map<docId, quantity>} を OperationResult から作成
    // quantity には statistics?.total?.quantity を使用する
    for (const operation of Vue.unref(operations)) {
      const map = operationMapByDate.get(operation.date) ?? new Map();
      map.set(operation.docId, operation.statistics?.total?.quantity ?? 0);
      // ↑ 同一 docId が存在すれば OperationResult で上書きになる
      operationMapByDate.set(operation.date, map);
    }

    // 各日付の合計を計算して result に格納
    for (const [date] of daysInRangeMap.value) {
      const map = operationMapByDate.get(date);
      const total = map
        ? [...map.values()].reduce((sum, qty) => sum + qty, 0)
        : 0;
      result.set(date, total);
    }

    return result;
  });
}
