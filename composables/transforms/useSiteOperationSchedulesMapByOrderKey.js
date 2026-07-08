/*****************************************************************************
 * @file ./composables/transforms/useSiteOperationSchedulesMapByOrderKey.js
 * @description 現場稼働予定ドキュメントの配列を受け取り、orderKey を key とした Map データを返します。
 *              orderKey: ${siteId}_${shiftType}
 *****************************************************************************/
import * as Vue from "vue";

/*****************************************************************************
 * @property {Array} schedules 現場稼働予定ドキュメントの配列
 * @returns {Map} 現場勤務区分オーダーキーを key とした Map データ
 * {
 *   orderKey: {
 *     schedules: Array, // 現場稼働予定ドキュメントの配列
 *     count: Number, // 現場稼働予定ドキュメントの件数
 *     hasMultiple: Boolean, // 現場稼働予定ドキュメントの件数が複数かどうか
 *   }
 * }
 *****************************************************************************/
export function useSiteOperationSchedulesMapByOrderKey(schedules) {
  return Vue.computed(() => {
    const source = Vue.toValue(schedules) ?? [];
    const map = new Map();

    source.forEach((schedule) => {
      const orderKey = schedule.orderKey;

      if (!map.has(orderKey)) {
        map.set(orderKey, {
          schedules: [],
          count: 0,
          hasMultiple: false,
          requiredPersonnel: 0,
        });
      }

      const entry = map.get(orderKey);
      entry.schedules.push(schedule);
      entry.count++;
      entry.hasMultiple = entry.count > 1;
    });

    return map;
  });
}
