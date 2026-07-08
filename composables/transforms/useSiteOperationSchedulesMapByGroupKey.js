/*****************************************************************************
 * @file ./composables/transforms/useSiteOperationSchedulesMapByGroupKey.js
 * @description 現場稼働予定ドキュメントの配列を受け取り、groupKey を key とした Map データを返します。
 *              groupKey: ${siteId}_${shiftType}_${date}
 * @note
 * - Map を拡張しており、returnEmptyEntry=true の場合、get で存在しない key を指定すると undefined ではなく空のオブジェクトを返します。
 * - returnEmptyEntry=true の場合でも has() の挙動は通常の Map と同じ。
 * - キーの存在確認には has() を利用すること。
 *****************************************************************************/
import * as Vue from "vue";

/*****************************************************************************
 * @param {Array} schedules 現場稼働予定ドキュメントの配列
 * @param {boolean} [returnEmptyEntry=false]
 *   存在しないキーに対して空エントリを返すかどうか
 * @returns {import("vue").ComputedRef<ExtendedMap>}
 * {
 *   groupKey: {
 *     schedules: Array, // 現場稼働予定ドキュメントの配列
 *     count: Number, // 現場稼働予定ドキュメントの件数
 *     hasMultiple: Boolean, // 現場稼働予定ドキュメントの件数が複数かどうか
 *     requiredPersonnel: Number, // 現場稼働予定ドキュメントの必要人員数の合計
 *   }
 * }
 *****************************************************************************/
export function useSiteOperationSchedulesMapByGroupKey(
  schedules,
  returnEmptyEntry = false,
) {
  /**
   * 空のエントリを作成して返します。
   * @returns {Object} 空のエントリ
   */
  function createEmptyEntry() {
    return {
      schedules: [],
      count: 0,
      hasMultiple: false,
      requiredPersonnel: 0,
    };
  }

  /**
   * get を拡張した Map クラス
   * - 存在しない key を指定した場合、undefined ではなく空のオブジェクトを返すようにする
   */
  class ExtendedMap extends Map {
    get(key) {
      if (!returnEmptyEntry) {
        return super.get(key);
      }
      return super.get(key) ?? createEmptyEntry();
    }
  }

  /**
   * groupKey を key とした Map データを返す
   * - groupKey: ${siteId}_${shiftType}_${date}
   */
  const map = Vue.computed(() => {
    const source = Vue.toValue(schedules) ?? [];
    const map = new ExtendedMap();

    source.forEach((schedule) => {
      const groupKey = schedule.groupKey;

      if (!map.has(groupKey)) {
        map.set(groupKey, createEmptyEntry());
      }

      const entry = map.get(groupKey);
      entry.schedules.push(schedule);
      entry.count++;
      entry.hasMultiple = entry.count > 1;
      entry.requiredPersonnel += schedule.requiredPersonnel;
    });

    return map;
  });

  return map;
}
