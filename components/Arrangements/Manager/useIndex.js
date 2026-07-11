/*****************************************************************************
 * ArrangementsManager 専用コンポーザブル
 * - 画面表示や操作に関する UI レイヤーのロジックをまとめます。
 * - データ取得やインデックス管理は useArrangementsInRange.js 側に寄せています。
 * - この composable は配置表 UI の補助と、更新・PDF・通知操作の仲介を担当します。
 *****************************************************************************/
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";
import { useSelectableDate } from "./useSelectableDate";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";
import { useArrangementNotificationsCommandText } from "@/composables/useArrangementNotificationsCommandText";

/**
 * ArrangementsManager の UI 補助 composable を返します。
 * - 選択中の日付の管理
 * - 通知 / 更新 / PDF / コマンド文生成の仲介
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @param {Ref<Array<Object>>} siteShiftTypeOrder - 現場勤務区分オーダーの配列（補完済み）
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

  /** 配置表 PDF 生成コンポーザブル */
  const { open: createPdf } = useArrangementSheetPdf();

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
   * - PDF composable 側で対象日付の schedule だけを抽出します。
   * @param {string} date - PDFを生成する対象の日付（例: "2024-01-01"）
   * @returns {Promise<void>}
   */
  const openPdf = async (date) => {
    const key = loadings.add(`Generating PDF for ${date}`);
    try {
      await createPdf({
        date,
        schedules: schedules.value,
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
