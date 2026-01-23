import * as Vue from "vue";
import { useDateRange } from "@/composables/useDateRange";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/**
 * @param {*} options
 * @param {Array} options.schedules 現場稼働予定ドキュメント配列
 * @param {Object} [options.dateRangeComposable] 日付範囲コンポーザブル
 * @param {Object} [options.fetchSiteComposable] 現場データフェッチ用コンポーザブル
 * @param {String} [options.dayFormat="MM/DD"] 日付フォーマット文字列
 * @param {Number} [options.dayHeight=36] 日付セルの高さ
 * @param {Number} [options.weekdayHeight=36] 曜日セルの高さ
 * @param {String|Number|undefined} [options.columnWidth] カラム幅
 * @param {Object} [options.siteShiftTypeOrder] 現場オーダー配列
 * @returns {Object} - An object containing the reactive `attrs` for SiteOperationScheduleTable.
 * @returns {Object} returns.attrs An attributes for SiteOperationScheduleTable
 */
export function useSiteOperationScheduleTable({
  schedules = [],
  dateRangeComposable: providedDateRangeComposable = undefined,
  fetchSiteComposable: providedFetchSiteComposable = undefined,
  dayFormat = "MM/DD",
  dayHeight = 36,
  weekdayHeight = 36,
  columnWidth = undefined,
  siteShiftTypeOrder = Vue.ref([]),
}) {
  /** SETUP COMPOSABLES */
  const dateRangeComposable = providedDateRangeComposable || useDateRange();
  const fetchSiteComposable = providedFetchSiteComposable || useFetchSite();

  /** WATCHERS */
  Vue.watch(
    schedules,
    (newSchedules) => {
      newSchedules.forEach((schedule) => {
        fetchSiteComposable.fetchSite(schedule.siteId); // 現場データをフェッチ
      });
    },
    { immediate: true },
  );

  /** SiteOperationScheduleTable 用 attrs */
  const attrs = Vue.computed(() => {
    return {
      startDate: dateRangeComposable.dateRange.value.from,
      endDate: dateRangeComposable.dateRange.value.to,
      dayFormat,
      dayHeight,
      weekdayHeight,
      siteShiftTypeOrder: siteShiftTypeOrder.value,
      cachedSites: fetchSiteComposable.cachedSites.value,
      columnWidth,
    };
  });

  return {
    attrs,
  };
}
