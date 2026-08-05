/*****************************************************************************
 * @file ./components/Arrangements/Manager/useIndex.js
 * @description ArrangementsManager 専用 local facade コンポーザブル
 * - ArrangementsManager で必要となる状態管理と操作（機能）を提供する専用コンポーザブルです。
 *****************************************************************************/
import * as Vue from "vue";
import { useArrangementsInRange } from "@/composables/dataLayers/arrangement/useArrangementsInRange";
import { useArrangementsActions } from "@/composables/application/arrangement/useArrangementsActions";
import { useSelectableDate } from "./useSelectableDate";
import { useFloatingWindow } from "@/composables/overlay/useFloatingWindow";
import { useTargetedMenu } from "@/composables/overlay/useTargetedMenu";
import { useManagedDialog } from "@/composables/overlay/useManagedDialog";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useConstants } from "@/composables/useConstants";
import { SiteOperationSchedule } from "@/schemas";
import { getEffectiveAssignedPersonnelCount } from "@/components/SiteOperationSchedule/effectiveWorker";

/**
 * 表示期間内の配置予定と通知から、日付単位の人数・状態集計を生成します。
 * - 状態件数は配置明細単位で数え、OJTも含めます。
 * - 配置人数は通知優先の実効OJT値で判定し、OJTを除外します。
 * - 通知なし・通知済みフラグなしは仮配置、通知とフラグの不整合や未知状態は要確認です。
 * @param {Array<Object>} schedules 表示期間内の現場稼働予定
 * @param {Array<Object>} notifications 表示期間内の配置通知
 * @param {Object} statusDefinitions `useConstants` の配置通知状態定義
 * @returns {Map<string, Object>} 日付（YYYY-MM-DD）をキーとする日別集計
 */
export function createDailyArrangementSummaries(
  schedules = [],
  notifications = [],
  statusDefinitions = {},
) {
  const statusKeyByValue = new Map(
    Object.entries(statusDefinitions).map(([key, definition]) => [
      definition.value,
      key.toLowerCase(),
    ]),
  );
  const notificationById = new Map(
    notifications.map((notification) => [notification.docId, notification]),
  );
  const result = new Map();

  for (const schedule of schedules) {
    if (!result.has(schedule.date)) {
      result.set(schedule.date, {
        required: 0,
        assigned: 0,
        difference: 0,
        provisional: 0,
        arranged: 0,
        confirmed: 0,
        arrived: 0,
        leaved: 0,
        needsReview: 0,
      });
    }

    const summary = result.get(schedule.date);
    summary.required += Number(schedule.requiredPersonnel) || 0;
    summary.assigned += getEffectiveAssignedPersonnelCount(
      schedule,
      notificationById,
    );

    for (const worker of schedule.workers || []) {
      const notification = notificationById.get(worker.notificationKey);
      if (!notification && !worker.hasNotification) {
        summary.provisional += 1;
        continue;
      }

      if (
        !notification ||
        !worker.hasNotification ||
        !statusKeyByValue.has(notification.status)
      ) {
        summary.needsReview += 1;
        continue;
      }

      summary[statusKeyByValue.get(notification.status)] += 1;
    }
  }

  for (const summary of result.values()) {
    summary.difference = summary.assigned - summary.required;
  }
  return result;
}

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
    notifications,
    getNotification,
    getConsecutiveWorkWarnings,
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

  /** 会社設定を反映した配置通知状態定義 */
  const { ARRANGEMENT_NOTIFICATION_STATUS } = useConstants();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const commandText = Vue.ref(null);
  const rowKeyToScroll = Vue.ref(null);
  /** 表示期間内データだけを使用する、配置管理固有の日別集計 */
  const dailySummaries = Vue.computed(() =>
    createDailyArrangementSummaries(
      schedules.value,
      notifications.value,
      ARRANGEMENT_NOTIFICATION_STATUS.value,
    ),
  );

  /** カードの過不足表示に使う、予定単位の通知優先実効配置人数 */
  const effectiveAssignedPersonnelCountByScheduleId = Vue.computed(() => {
    const notificationById = new Map(
      notifications.value.map((notification) => [
        notification.docId,
        notification,
      ]),
    );
    return new Map(
      schedules.value.map((schedule) => [
        schedule.docId,
        getEffectiveAssignedPersonnelCount(schedule, notificationById),
      ]),
    );
  });

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
          dailySummary: {
            getAttrs: ({ column }) => ({
              summary: dailySummaries.value.get(column.date),
            }),
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
                assignedPersonnelCount:
                  effectiveAssignedPersonnelCountByScheduleId.value.get(
                    slotProps.schedule.docId,
                  ),
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
                consecutiveWorkWarnings: slotProps.worker.isEmployee
                  ? getConsecutiveWorkWarnings({
                      scheduleId: schedule.docId,
                      employeeId: slotProps.worker.workerId,
                    })
                  : [],
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
