import * as Vue from "vue";

/*****************************************************************************
 * @file ./composables/domain/operation/useOperationQuantityBySecurityTypeInRange.js
 * @description 指定期間の日付・警備種別ごとの稼働数を返す
 * - `daysInRangeMap` に含まれる日付の範囲に対して、`schedules` と `operations` の情報をもとに警備種別ごとの稼働数を計算して返します。
 * - `schedules` は SiteOperationSchedule の配列で、`requiredPersonnel` が使用されます。
 * - `operations` は OperationResult の配列で、`statistics?.total?.quantity` が使用されます。
 * - SiteOperationSchedule をベースに作成された OperationResult は同一の docId を有することを利用して
 *   OperationResult の情報が優先されるようにしています。
 * @param {Object} options - オプションオブジェクト
 * @param {Vue.Ref<Array<SiteOperationSchedule>>} options.schedules - SiteOperationSchedule の配列を保持する参照
 * @param {Vue.Ref<Array<OperationResult>>} options.operations - OperationResult の配列を保持する参照
 * @param {Vue.Ref<Map<string, any>>} options.daysInRangeMap - 日付の範囲を保持する Map の参照
 * @returns {Vue.ComputedRef<Map<string, Map<string, number>>>} 日付・警備種別ごとの稼働数を返す計算済みの参照
 *****************************************************************************/
export function useOperationQuantityBySecurityTypeInRange({
  schedules,
  operations,
  daysInRangeMap,
}) {
  return Vue.computed(() => {
    const result = new Map();

    // date -> securityType -> docId -> quantity
    const quantityMapByDate = new Map();

    /*************************************************************************
     * SiteOperationSchedule
     *************************************************************************/
    for (const schedule of Vue.unref(schedules)) {
      const securityTypeMap = quantityMapByDate.get(schedule.date) ?? new Map();

      const operationMap =
        securityTypeMap.get(schedule.securityType) ?? new Map();

      operationMap.set(schedule.docId, schedule.requiredPersonnel ?? 0);

      securityTypeMap.set(schedule.securityType, operationMap);
      quantityMapByDate.set(schedule.date, securityTypeMap);
    }

    /*************************************************************************
     * OperationResult
     *************************************************************************/
    for (const operation of Vue.unref(operations)) {
      const securityTypeMap =
        quantityMapByDate.get(operation.date) ?? new Map();

      const operationMap =
        securityTypeMap.get(operation.securityType) ?? new Map();

      // OperationResult が優先
      operationMap.set(
        operation.docId,
        operation.statistics?.total?.quantity ?? 0,
      );

      securityTypeMap.set(operation.securityType, operationMap);
      quantityMapByDate.set(operation.date, securityTypeMap);
    }

    /*************************************************************************
     * 日毎・警備種別毎の合計を作成
     *************************************************************************/
    for (const [date] of daysInRangeMap.value) {
      const securityTypeMap = quantityMapByDate.get(date) ?? new Map();

      const totalBySecurityType = new Map();

      for (const [securityType, operationMap] of securityTypeMap) {
        const total = [...operationMap.values()].reduce(
          (sum, qty) => sum + qty,
          0,
        );

        totalBySecurityType.set(securityType, total);
      }

      result.set(date, totalBySecurityType);
    }

    return result;
  });
}
