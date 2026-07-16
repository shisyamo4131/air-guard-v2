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
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * @param {Object} props
 * @param {string} props.startDate - 開始日付（YYYY-MM-DD）
 * @param {string} props.endDate - 終了日付（YYYY-MM-DD）
 * @param {Object} options
 * @param {Ref} options.refSiteOperationScheduleManager - 現場稼働予定管理コンポーネントの ref
 * @param {Ref} options.refArrangementNotificationManager - 通知ステータス更新コンポーネントの ref
 * @param {Ref} options.refWorkerManager - 作業員管理コンポーネントの ref
 * @returns {Object} - ArrangementsManager 専用 local facade コンポーザブル
 * @returns {{
 *   uiTable: ComputedRef<Object>,
 *   uiWorkerSelector: ComputedRef<Object>,
 *   uiSiteShiftTypeJumpList: ComputedRef<Object>,
 *   uiSiteShiftTypeReorder: ComputedRef<Object>,
 *   uiSiteOperationScheduleDuplicator: ComputedRef<Object>,
 *   uiCommandTextDialog: ComputedRef<Object>,
 *   uiSpeedDial: ComputedRef<Object>,
 * }}
 *****************************************************************************/
export function useIndex(
  props,
  {
    refSiteOperationScheduleManager: refScheduleManager,
    refArrangementNotificationManager: refNotificationManager,
    refWorkerManager,
  } = {},
) {
  /*****************************************************************************
   * SETUP DATA LAYER COMPOSABLE
   *****************************************************************************/
  const {
    schedules,
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

  /** 現場稼働予定複製コンポーザブル */
  const duplicatorComposable = useSiteOperationScheduleDuplicator();

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
    const fn = refScheduleManager?.value?.toCreate;
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
            getAttrs: (slotProps) => {
              return {
                column: slotProps.column,
                isSelected: slotProps.isSelected,
                "onClick:command-text": ($event) =>
                  (commandText.value =
                    arrangementsActions.getCommandText($event)),
                "onClick:focus": ($event) => (selectedDate.value = $event),
                "onClick:jump-list": siteShiftTypeJumpListMenu.open,
                "onClick:pdf": arrangementsActions.openPdf,
              };
            },
          },
          draggableOperationSchedules: {
            getAttrs: (slotProps) => {
              return {
                schedules: slotProps.schedules,
                disabled: slotProps.disabled,
                "onUpdate:schedules": ($event) => {
                  arrangementsActions.updateSchedules($event, {
                    date: slotProps.date,
                    siteId: slotProps.siteId,
                    shiftType: slotProps.shiftType,
                  });
                },
              };
            },
          },
          siteOperationScheduleCard: {
            getAttrs: (slotProps) => {
              return {
                disabled: slotProps.disabled,
                schedule: slotProps.schedule,
                isDraggable: true,
                showActions: true,
                "onClick:duplicate": () =>
                  duplicatorComposable.set(slotProps.schedule),
                "onClick:edit": () =>
                  refScheduleManager?.value?.toUpdate(slotProps.schedule),
                "onClick:notify": () =>
                  arrangementsActions.notify(slotProps.schedule),
                "onUpdate:schedule": ($event) =>
                  arrangementsActions.updateSchedule($event),
              };
            },
          },
          draggableWorkers: {
            getAttrs: (slotProps) => {
              return {
                disabled: slotProps.disabled,
                modelValue: slotProps.modelValue,
                "onUpdate:modelValue": slotProps["onUpdate:modelValue"],
              };
            },
          },
          workerTag: {
            getAttrs: ({ slotProps, schedule }) => {
              return {
                highlight: slotProps.highlight,
                hideEdit: !!slotProps.disabled,
                hideNotification: !!slotProps.disabled,
                isDraggable: slotProps.isDraggable,
                notification: getNotification(slotProps.worker),
                removable: slotProps.removable,
                schedule,
                worker: slotProps.worker,
                "onClick:edit": () =>
                  refWorkerManager?.value?.toUpdate({
                    schedule,
                    worker: slotProps.worker,
                  }),
                "onClick:notification": ($event) =>
                  refNotificationManager?.value?.toUpdate($event),
                "onClick:remove": ($event) =>
                  slotProps["onClick:remove"]?.($event),
              };
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
    uiSiteOperationScheduleDuplicator: Vue.computed(() => {
      return {
        attrs: duplicatorComposable.attrs.value,
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
  };
}
