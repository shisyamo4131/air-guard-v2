/*****************************************************************************
 * @file ./composables/application/arrangement/useArrangementsActions.js
 * @description
 * - 配置管理に必要な機能を提供する application コンポーザブルです。
 * - 独立している各種機能をまとめて提供するため、Facade 的な実装になっています。
 * @use useOpenArrangementSheetPdf - 配置表生成アクション
 * @use useArrangementNotificationsCommandText - 配置指示テキスト生成アクション
 * @use SiteOperationScheduleActions - 現場稼働予定更新アクション
 * @use SiteShiftTypeOrderActions - 現場勤務区分オーダー更新アクション
 *****************************************************************************/
import { useArrangementNotificationsCommandText } from "@/composables/useArrangementNotificationsCommandText";
import { useOpenArrangementSheetPdf } from "@/composables/application/arrangement/useOpenArrangementSheetPdf";
import { useSiteOperationScheduleActions } from "@/composables/application/siteOperationSchedule/useSiteOperationScheduleActions";
import { useSiteShiftTypeOrderActions } from "@/composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions";
import { TYPE as ORDER_TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

/*****************************************************************************
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @param {Ref<Array<Object>>} siteShiftTypeOrder - 現場勤務区分オーダーの配列（補完済み）
 * @returns {{
 *   openPdf: Function,
 *   getCommandText: Function,
 *   notify: Function,
 *   updateSchedule: Function,
 *   updateSchedules: Function,
 *   updateSiteShiftTypeOrder: Function,
 *   removeSiteShiftTypeOrder: Function,
 * }}
 *****************************************************************************/
export function useArrangementsActions({ schedules, siteShiftTypeOrder } = {}) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { openPdf: openArrangementSheetPdf } = useOpenArrangementSheetPdf();
  const { getCommandText } = useArrangementNotificationsCommandText({
    schedules,
    siteShiftTypeOrder,
  });
  const { notify, updateSchedule, updateSchedules } =
    useSiteOperationScheduleActions();
  const { update: updateSiteShiftTypeOrder, remove: removeSiteShiftTypeOrder } =
    useSiteShiftTypeOrderActions({
      type: ORDER_TYPE.ARRANGEMENT,
    });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 指定された日付の配置表PDFを生成して表示します。
   * @param {string} date - PDFを生成する対象の日付（例: "2024-01-01"）
   * @returns {Promise<void>}
   */
  const openPdf = async (date) => {
    await openArrangementSheetPdf({
      date,
      schedules: schedules.value, // useArrangementSheetPdf 側での fetch を避けて読み取り件数を抑制
      siteShiftTypeOrder: siteShiftTypeOrder.value,
    });
  };

  return {
    openPdf,
    getCommandText,
    notify,
    updateSchedule,
    updateSchedules,
    updateSiteShiftTypeOrder,
    removeSiteShiftTypeOrder,
  };
}
