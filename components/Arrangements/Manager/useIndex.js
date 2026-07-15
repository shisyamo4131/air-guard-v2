/*****************************************************************************
 * @file ./components/Arrangements/Manager/useIndex.js
 * @description ArrangementsManager 専用 local facade コンポーザブル
 * - ArrangementsManager で必要となる状態管理と操作（機能）を提供する専用コンポーザブルです。
 *****************************************************************************/
import * as Vue from "vue";
import { useArrangementsInRange } from "@/composables/dataLayers/useArrangementsInRange";
import { useArrangementsActions } from "@/composables/application/arrangement/useArrangementsActions";
import { useSelectableDate } from "./useSelectableDate";
import { useFloatingWindow } from "@/composables/overlay/useFloatingWindow";
import { useTargetedMenu } from "@/composables/overlay/useTargetedMenu";
import { useManagedDialog } from "@/composables/overlay/useManagedDialog";
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * @param {Object} props
 * @param {string} props.startDate - 開始日付（YYYY-MM-DD）
 * @param {string} props.endDate - 終了日付（YYYY-MM-DD）
 * @returns {{
 *   uiTable: ComputedRef<Object>,
 *   uiWorkerSelector: ComputedRef<Object>,
 *   uiSiteShiftTypeJumpList: ComputedRef<Object>,
 *   uiSiteShiftTypeReorder: ComputedRef<Object>,
 *   uiCommandTextDialog: ComputedRef<Object>,
 *   uiSpeedDial: ComputedRef<Object>,
 *   getNotification: Function,
 *   notify: Function,
 *   updateSchedule: Function,
 *   updateSchedules: Function,
 *   updateSiteShiftTypeOrder: Function,
 * }}
 *****************************************************************************/
// export function useIndex({ schedules, siteShiftTypeOrder } = {}) {
export function useIndex(
  props,
  {
    refSiteOperationScheduleManager,
    refArrangementNotificationManager,
    refWorkerManager,
  } = {},
) {
  /*****************************************************************************
   * SETUP DATA LAYER COMPOSABLE
   *****************************************************************************/
  const {
    schedules,
    notificationIndexes,
    getNotification,
    isEmployeeArranged,
    selectableEmployees,
    selectableOutsourcers,
    siteShiftTypeOrder, // 補完済みの現場勤務区分オーダー
  } = useArrangementsInRange({
    from: Vue.toRef(() => props.startDate),
    to: Vue.toRef(() => props.endDate),
  });

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
   * DEFINE STATES
   *****************************************************************************/
  const commandText = Vue.ref(null);
  const rowKeyToScroll = Vue.ref(null);

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * `siteOperationScheduleManager` の `toCreate` メソッドを実行します。
   * @param {string} options.siteId - 現場ドキュメントID
   * @param {string} options.shiftType - 勤務区分
   */
  async function handleClickCreateSchedule({ siteId, shiftType } = {}) {
    const fn = refSiteOperationScheduleManager?.value?.toCreate;
    if (!fn) return;
    await fn(new SiteOperationSchedule({ siteId, shiftType }));
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    /** UI controller */
    uiTable: Vue.computed(() => {
      return {
        component: {
          attrs: {
            columnWidth: 256,
            dayFormat: "MM/DD(ddd)",
            endDate: props.endDate,
            notificationIndexes: notificationIndexes.value,
            schedules: schedules.value,
            scrollToRowKey: rowKeyToScroll.value,
            selectedDate: selectedDate.value,
            siteShiftTypeOrder: siteShiftTypeOrder.value,
            startDate: props.startDate,
            "onClick:add-schedule": handleClickCreateSchedule,
            "onClick:remove-site-order":
              arrangementsActions.removeSiteShiftTypeOrder,
            "onUpdate:scrollToRowKey": (newKey) =>
              (rowKeyToScroll.value = newKey),
          },
          weekdayActions: {
            attrs: {
              "onClick:command-text": ($event) =>
                (commandText.value =
                  arrangementsActions.getCommandText($event)),
              "onClick:focus": ($event) => (selectedDate.value = $event),
              "onClick:jump-list": siteShiftTypeJumpListMenu.open,
              "onClick:pdf": arrangementsActions.openPdf,
            },
          },
        },
      };
    }),
    uiWorkerSelector: Vue.computed(() => {
      return {
        dialog: {
          attrs: workerSelectorWindow.attrs.value,
        },
        component: {
          attrs: {
            employees: selectableEmployees.value,
            outsourcers: selectableOutsourcers.value,
            isEmployeeArranged,
          },
        },
        toggle: workerSelectorWindow.toggle,
      };
    }),
    uiSiteShiftTypeJumpList: Vue.computed(() => {
      return {
        menu: {
          attrs: siteShiftTypeJumpListMenu.attrs.value,
        },
        component: {
          attrs: {
            siteShiftTypeOrder: siteShiftTypeOrder.value,
            density: "compact",
            "onClick:select": ({ id }) => (rowKeyToScroll.value = id.key),
          },
        },
      };
    }),
    uiSiteShiftTypeReorder: Vue.computed(() => {
      return {
        dialog: {
          attrs: { ...siteShiftTypeReorderDialog.attrs.value, maxWidth: "480" },
          open: siteShiftTypeReorderDialog.open,
        },
        component: {
          attrs: {
            loading: siteShiftTypeReorderDialog.isLoading.value,
            siteShiftTypeOrder: siteShiftTypeOrder.value,
            onSubmit: siteShiftTypeReorderDialog.submit,
            onCancel: siteShiftTypeReorderDialog.cancel,
          },
        },
      };
    }),
    uiCommandTextDialog: Vue.computed(() => {
      return {
        attrs: {
          modelValue: commandText.value,
          "onUpdate:modelValue": () => (commandText.value = null),
        },
      };
    }),
    uiSpeedDial: Vue.computed(() => {
      return {
        attrs: {
          app: true,
          location: "bottom right",
          color: "primary",
          "onClick:workers": workerSelectorWindow.toggle,
          "onClick:add-schedule": handleClickCreateSchedule,
          "onClick:site-shift-type-order": siteShiftTypeReorderDialog.open,
        },
      };
    }),

    /** METHODS */
    getNotification,
    notify: arrangementsActions.notify,
    updateSchedule: arrangementsActions.updateSchedule,
    updateSchedules: arrangementsActions.updateSchedules,
    updateSiteShiftTypeOrder: arrangementsActions.updateSiteShiftTypeOrder,
  };
}
