/*****************************************************************************
 * @file ./components/Arrangements/Manager/useIndex.js
 * @description ArrangementsManager 専用 local facade コンポーザブル
 * - ArrangementsManager で必要となる状態管理と操作（機能）を提供する専用コンポーザブルです。
 *****************************************************************************/
import * as Vue from "vue";
import { useArrangementsActions } from "@/composables/application/arrangement/useArrangementsActions";
import { useSelectableDate } from "./useSelectableDate";
import { useFloatingWindow } from "@/composables/overlay/useFloatingWindow";
import { useTargetedMenu } from "@/composables/overlay/useTargetedMenu";
import { useManagedDialog } from "@/composables/overlay/useManagedDialog";

/*****************************************************************************
 * @param {import("@/schemas").SiteOperationSchedule[]} schedules - 表示対象のスケジュール配列
 * @param {Ref<Array<Object>>} siteShiftTypeOrder - 現場勤務区分オーダーの配列（補完済み）
 * @returns {{
 *   selectedDate: Ref<string|null>,
 *   uiWorkerSelector: ComputedRef<Object>,
 *   uiSiteShiftTypeJumpListMenu: ComputedRef<Object>,
 *   uiSiteShiftTypeReorderDialog: ComputedRef<Object>,
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

  /** 作業員選択フローティングウィンドウ制御 */
  const workerSelectorWindow = useFloatingWindow();

  /** 現場勤務区分オーダージャンプメニュー制御 */
  const siteShiftTypeJumpListMenu = useTargetedMenu({ target: ".v-btn" });

  /** 現場勤務区分オーダー並び替えダイアログ制御 */
  const siteShiftTypeReorderDialog = useManagedDialog({
    loggerName: "ArrangementsManagerSiteShiftTypeReorder",
    closeOnSubmit: true,
    onSubmit: arrangementsActions.updateSiteShiftTypeOrder,
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    /** DATA  */
    selectedDate,

    /** UI controller */
    uiWorkerSelector: Vue.computed(() => {
      return {
        attrs: workerSelectorWindow.attrs.value,
        toggle: workerSelectorWindow.toggle,
      };
    }),
    uiSiteShiftTypeJumpListMenu: Vue.computed(() => {
      return {
        attrs: siteShiftTypeJumpListMenu.attrs.value,
        open: siteShiftTypeJumpListMenu.open,
      };
    }),
    uiSiteShiftTypeReorderDialog: Vue.computed(() => {
      return {
        attrs: siteShiftTypeReorderDialog.attrs.value,
        open: siteShiftTypeReorderDialog.open,
        loading: siteShiftTypeReorderDialog.isLoading.value,
        onSubmit: siteShiftTypeReorderDialog.submit,
        onCancel: siteShiftTypeReorderDialog.cancel,
      };
    }),

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
