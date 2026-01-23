/*****************************************************************************
 * 現場稼働予定選択用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/**
 * @param {Object} options
 * @param {Array} options.docs 現場稼働予定ドキュメントの配列
 * @param {Object} [options.fetchSiteComposable] 現場データ取得用の composable
 * @returns {Object} returns
 * @returns {import('vue').ComputedRef<Object>} returns.attrs SiteOperationScheduleSelector に渡す属性オブジェクト
 * @returns {import('vue').ComputedRef<boolean>} returns.dialog ダイアログの表示制御用リアクティブ変数
 * @returns {Function} returns.set 選択用ダイアログを表示するための関数
 */
export function useSiteOperationScheduleSelector({
  docs = [],
  fetchSiteComposable: providedFetchSiteComposable = undefined,
}) {
  /** SETUP REACTIVE OBJECTS */
  const selectedDateAt = Vue.ref(null);
  const selectedSiteId = Vue.ref(null);
  const selectedShiftType = Vue.ref(null);
  const selectedGroupKey = Vue.ref(null);

  const internalDialog = Vue.ref(false);

  /** SETUP COMPOSABLES */
  const fetchSiteComposable = providedFetchSiteComposable ?? useFetchSite();

  /**
   * 選択されたグループキーに基づいてフィルタリングされた現場稼働予定の配列を返します。
   */
  const filteredSchedules = Vue.computed(() => {
    if (!selectedGroupKey.value) return [];
    return docs.filter(({ groupKey }) => groupKey === selectedGroupKey.value);
  });

  /** SiteOperationScheduleSelector 用 attrs */
  const attrs = Vue.computed(() => {
    return {
      fetchSiteComposable,
      siteId: selectedSiteId.value,
      dateAt: selectedDateAt.value,
      shiftType: selectedShiftType.value,
      schedules: filteredSchedules.value,
      "onClick:close": () => (dialog.value = false),
    };
  });

  /** SiteOperationScheduleSelector 起動用関数 */
  const set = ({ dateAt, siteId, shiftType, groupKey }) => {
    selectedDateAt.value = dateAt;
    selectedSiteId.value = siteId;
    selectedShiftType.value = shiftType;
    selectedGroupKey.value = groupKey;
    dialog.value = true;
  };

  /** ダイアログ制御 */
  const dialog = Vue.computed({
    get() {
      return internalDialog.value;
    },
    set(v) {
      internalDialog.value = v;
    },
  });

  return { attrs, dialog, set };
}
