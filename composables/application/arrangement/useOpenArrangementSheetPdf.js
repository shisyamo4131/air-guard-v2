import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";

/**
 * 配置表 PDF を開くための application composable。
 * - PDF 生成そのものは useArrangementSheetPdf に委譲します。
 * - この composable は、画面操作として必要な loading と error handling を担当します。
 */
export function useOpenArrangementSheetPdf() {
  const loadings = useLoadingsStore();
  const logger = useLogger("useOpenArrangementSheetPdf");
  const { open } = useArrangementSheetPdf();

  /**
   * 指定日の配置表 PDF を生成して開きます。
   * @param {Object} options
   * @param {string} options.date - PDF を生成する対象日
   * @param {Array<Object>} [options.schedules] - 事前に取得済みの現場稼働予定配列
   * @param {Array<Object>} [options.siteShiftTypeOrder] - 補完済みの現場勤務区分オーダー
   * @returns {Promise<void>}
   */
  async function openPdf({ date, schedules, siteShiftTypeOrder } = {}) {
    const key = loadings.add(`Generating PDF for ${date}`);
    try {
      await open({
        date,
        schedules,
        siteShiftTypeOrder,
      });
    } catch (error) {
      logger.error({
        message: "Failed to open arrangement sheet PDF",
        error,
      });
    } finally {
      loadings.remove(key);
    }
  }

  return { openPdf };
}
