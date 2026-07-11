/*****************************************************************************
 * @file ./components/Arrangements/Manager/useIndex.js
 * @description ArrangementsManager 専用 コンポーザブル
 * - ArrangementsManager で必要となる状態管理と操作（機能）を提供する専用コンポーザブルです。
 *****************************************************************************/
import { useSelectableDate } from "./useSelectableDate";
import { useArrangementNotificationsCommandText } from "@/composables/useArrangementNotificationsCommandText";
import { useOpenArrangementSheetPdf } from "@/composables/application/arrangement/useOpenArrangementSheetPdf";

/*****************************************************************************
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @param {Ref<Array<Object>>} siteShiftTypeOrder - 現場勤務区分オーダーの配列（補完済み）
 * @returns {{
 *   selectedDate: Ref<string|null>,
 *   openPdf: Function,
 *   getCommandText: Function,
 * }}
 *****************************************************************************/
export function useIndex({ schedules, siteShiftTypeOrder } = {}) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { openPdf: openArrangementSheetPdf } = useOpenArrangementSheetPdf();

  const { getCommandText } = useArrangementNotificationsCommandText({
    schedules,
    siteShiftTypeOrder,
  });

  /** 選択中日付管理コンポーザブル */
  const { selectedDate } = useSelectableDate();

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
    /** DATA  */
    selectedDate,

    /** METHODS */
    openPdf,
    getCommandText,
  };
}
