/*****************************************************************************
 * ArrangementsManager 専用コンポーザブル
 * - 画面表示や操作に関する UI レイヤーのロジックをまとめます。
 * - データ取得やインデックス管理は useArrangementsInRange.js 側に寄せています。
 * - この composable は配置表 UI の補助と、更新・PDF・通知操作の仲介を担当します。
 *****************************************************************************/
import * as Vue from "vue";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";
import { useFetch } from "@/composables/fetch/useFetch";
import { useSelectableDate } from "./useSelectableDate";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";
import { useArrangementNotificationsCommandText } from "@/composables/useArrangementNotificationsCommandText";

/**
 * ArrangementsManager の UI 補助 composable を返します。
 * - 選択中の日付の管理
 * - 通知 / 更新 / PDF / コマンド文生成の仲介
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @returns {{
 *   selectedDate: Ref<string|null>,
 *   openPdf: Function,
 *   getCommandText: Function,
 * }}
 */

export function useIndex({ schedules, siteShiftTypeOrder } = {}) {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const loadings = useLoadingsStore();

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("ArrangementsManager");
  const {
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  } = useFetch("ArrangementsManager");

  /**
   * 配置表PDF作成コンポーザブル
   */
  const pdfComposable = useArrangementSheetPdf({
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  });

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
   * - ローディング状態を管理し、PDF生成中はユーザーにフィードバックを提供します。
   * - 対象日付の schedule だけを抽出して PDF composable に渡します。
   * @param {string} date - PDFを生成する対象の日付（例: "2024-01-01"）
   * @returns {Promise<void>}
   */
  const openPdf = async (date) => {
    const key = loadings.add(`Generating PDF for ${date}`);
    try {
      const dayFilteredSchedules = Vue.unref(schedules).filter(
        (schedule) => schedule.date === date,
      );
      await pdfComposable.open({
        date,
        schedules: dayFilteredSchedules,
        siteShiftTypeOrder: siteShiftTypeOrder.value,
      });
    } catch (error) {
      logger.error({ message: "Failed to open arrangement sheet PDF", error });
    } finally {
      loadings.remove(key);
    }
  };

  return {
    /** DATA  */
    selectedDate,

    /** METHODS */
    openPdf,
    getCommandText,
  };
}
