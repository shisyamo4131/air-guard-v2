/*****************************************************************************
 * ArrangementsManager 専用コンポーザブル
 * - 画面表示や操作に関する UI レイヤーのロジックをまとめます。
 * - データ取得やインデックス管理は useArrangementsInRange.js 側に寄せています。
 * - この composable は配置表 UI の補助と、更新・PDF・通知操作の仲介を担当します。
 *****************************************************************************/
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "../composables/useLogger";
import { useFetch } from "@/composables/fetch/useFetch";
import { useSiteShiftTypeOrder } from "@/composables/dataLayers/useSiteShiftTypeOrder.js";
import { useSiteShiftTypeReorder } from "@/composables/useSiteShiftTypeReorder";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";
import { useArrangementNotificationsCommandText } from "@/composables/useArrangementNotificationsCommandText";
import * as Vue from "vue";

/**
 * ArrangementsManager の UI 補助 composable を返します。
 * - 現場勤務区分の並び替え
 * - スケジュール複製
 * - 選択中の日付の管理
 * - 通知 / 更新 / PDF / コマンド文生成の仲介
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @returns {{
 *   siteShiftTypeReorderComposable: Object,
 *   duplicatorComposable: Object,
 *   siteShiftTypeOrder: Array,
 *   selectedDate: Ref<string|null>,
 *   openPdf: Function,
 *   getCommandText: Function,
 *   removeSiteShiftTypeOrder: Function,
 * }}
 */

export function useIndex(schedules) {
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
   * Site Shift Type Order Composable
   * @description 現場勤務区分オーダーを管理
   */
  const siteShiftTypeOrderComposable = useSiteShiftTypeOrder({
    schedules,
  });

  /**
   * Site Shift Type Reorder Composable
   * @description 現場勤務区分の並び替えを管理
   */
  const siteShiftTypeReorderComposable = useSiteShiftTypeReorder({
    items: siteShiftTypeOrderComposable.siteShiftTypeOrder,
    onUpdate: siteShiftTypeOrderComposable.update,
  });

  /**
   * Duplicator Composable
   * @description 現場運用スケジュール複製用コンポーザブル
   */
  const duplicatorComposable = useSiteOperationScheduleDuplicator();

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
    siteShiftTypeOrder: siteShiftTypeOrderComposable.siteShiftTypeOrder,
  });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const internalSelectedDate = Vue.ref(null); // コンポーネントで選択された日付文字列

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * 選択中の日付
   * - `OperationSchedulesTable` の `selectedDate` と双方向バインディングされる予定の状態です。
   * - `OperationSchedulesTable` 内で日付が選択されると、この状態が更新されます。
   * - 選択解除のため、同じ日付が再選択された場合は `null` に戻します。
   * - 初期値は null で、日付が選択されていない状態を表します。
   */
  const selectedDate = Vue.computed({
    get() {
      return internalSelectedDate.value;
    },
    set(v) {
      if (v === internalSelectedDate.value) {
        internalSelectedDate.value = null; // 同じ日付が選択された場合は選択を解除
        return;
      }
      internalSelectedDate.value = v;
    },
  });

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
      const dayFilteredSchedules = schedules.filter(
        (schedule) => schedule.date === date,
      );
      await pdfComposable.open({ date, schedules: dayFilteredSchedules });
    } catch (error) {
      logger.error({ message: "Failed to open arrangement sheet PDF", error });
    } finally {
      loadings.remove(key);
    }
  };

  return {
    /** COMPOSABLES: 後方互換 */
    siteShiftTypeReorderComposable,
    duplicatorComposable,

    /** DATA  */
    siteShiftTypeOrder: siteShiftTypeOrderComposable.siteShiftTypeOrder,
    selectedDate,

    /** METHODS */
    openPdf,
    getCommandText,
    removeSiteShiftTypeOrder: siteShiftTypeOrderComposable.remove,
  };
}
