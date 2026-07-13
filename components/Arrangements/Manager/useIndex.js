/*****************************************************************************
 * @file ./components/Arrangements/Manager/useIndex.js
 * @description ArrangementsManager 専用 local facade コンポーザブル
 * - ArrangementsManager で必要となる状態管理と操作（機能）を提供する専用コンポーザブルです。
 *****************************************************************************/
import { useArrangementsActions } from "@/composables/application/arrangement/useArrangementsActions";
import { useSelectableDate } from "./useSelectableDate";

/*****************************************************************************
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @param {Ref<Array<Object>>} siteShiftTypeOrder - 現場勤務区分オーダーの配列（補完済み）
 * @returns {{
 *   selectedDate: Ref<string|null>,
 *   openPdf: Function,
 *   getCommandText: Function,
 *   notify: Function,
 *   updateSchedule: Function,
 *   updateSchedules: Function,
 *   updateSiteShiftTypeOrder: Function,
 *   removeSiteShiftTypeOrder: Function,
 * }}
 *****************************************************************************/
export function useIndex({ schedules, siteShiftTypeOrder } = {}) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const arrangementsActions = useArrangementsActions({
    schedules,
    siteShiftTypeOrder,
  });

  /**
   * 選択中日付管理コンポーザブル
   * - 現在選択中である日付を管理します。
   */
  const { selectedDate } = useSelectableDate();

  return {
    /** DATA  */
    selectedDate,

    /** METHODS */
    openPdf: arrangementsActions.openPdf,
    getCommandText: arrangementsActions.getCommandText,
    notify: arrangementsActions.notify,
    updateSchedule: arrangementsActions.updateSchedule,
    updateSchedules: arrangementsActions.updateSchedules,
    updateSiteShiftTypeOrder: arrangementsActions.updateSiteShiftTypeOrder,
    removeSiteShiftTypeOrder: arrangementsActions.removeSiteShiftTypeOrder,
  };
}
