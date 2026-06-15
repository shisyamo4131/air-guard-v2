/*****************************************************************************
 * ArrangementsManager 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "../composables/useLogger";
import { useFetch } from "@/composables/fetch/useFetch";
import { useSiteShiftTypeOrder } from "@/composables/dataLayers/useSiteShiftTypeOrder.js";
import { useSiteShiftTypeReorder } from "@/composables/useSiteShiftTypeReorder";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";
import { useArrangementNotificationsCommandText } from "@/composables/useArrangementNotificationsCommandText";

/**
 * @return {Object} - siteShiftTypeReorderComposable
 * @return {Object} - duplicatorComposable
 * @return {Array} - siteShiftTypeOrder
 * @return {Map} - arrangedEmployeesMap
 * @return {Map} - arrangedOutsourcersMap
 * @return {Map} - schedulesMap
 * @return {Map} - notificationsMap
 * @return {Ref} - selectedDate
 * @return {Function} - isEmployeeArranged
 * @return {Function} - notify
 * @return {Function} - updateSchedule
 * @return {Function} - updateSchedules
 * @return {Function} - openPdf
 * @return {Function} - getCommandText
 */
export function useIndex(schedules, notifications) {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();
  const isDev = Vue.computed(() => auth.isDev);
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
   * METHODS (INTERNAL)
   *****************************************************************************/
  /**
   * `siteId`、`shiftType`、`date` を組み合わせて一意の `groupKey` を生成します。
   * - これにより、特定の条件に対応する現場稼働予定ドキュメントへの高速なアクセスが可能になります。
   * [groupKey]
   * - `siteId`、`shiftType`、`dateAt` を組み合わせた文字列で構成される一意の識別子
   * @param {Object} options
   * @param {string} options.siteId - 現場 ID
   * @param {string} options.shiftType - シフト種別
   * @param {string} options.date - 日付文字列（YYYY-MM-DD）
   * @returns {string} `siteId`、`shiftType`、`date` を組み合わせた一意の `groupKey`
   */
  function _createGroupKey({ siteId, shiftType, date }) {
    return `${siteId}_${shiftType}_${date}`;
  }

  /**
   * `siteOperationScheduleId` と `workerId` を組み合わせて一意の `notificationKey` を生成します。
   * - これにより、特定の条件に対応する配置通知ドキュメントへの高速なアクセスが可能になります。
   * [notificationKey]
   * - `siteOperationScheduleId` と `workerId` を組み合わせた文字列で構成される一意の識別子
   * @param {Object} options
   * @param {string} options.siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @param {string} options.workerId - 作業者の ID
   * @returns {string} `siteOperationScheduleId` と `workerId` を組み合わせた一意の `notificationKey`
   */
  function _createNotificationKey({ siteOperationScheduleId, workerId }) {
    return `${siteOperationScheduleId}_${workerId}`;
  }

  /**
   * 日付・勤務区分ごとの配置済みIDマップを生成します。
   * @param {Object[]} schedules
   * @param {string} property - "employeeIds" または "outsourcerIds"
   * @returns {Map<string, Map<string, string[]>>}
   */
  function _createArrangementMap(schedules, property) {
    const result = new Map();

    for (const schedule of schedules) {
      const dateKey = schedule.date;

      if (!result.has(dateKey)) {
        result.set(
          dateKey,
          new Map([
            ["allDay", []],
            [SiteOperationSchedule.SHIFT_TYPE.DAY.value, []],
            [SiteOperationSchedule.SHIFT_TYPE.NIGHT.value, []],
          ]),
        );
      }

      const entry = result.get(dateKey);
      const ids = schedule[property] || [];

      entry.get("allDay").push(...ids);

      const shiftList = entry.get(schedule.shiftType);
      if (shiftList) {
        shiftList.push(...ids);
      }
    }

    // 重複除去
    for (const entry of result.values()) {
      for (const [key, value] of entry.entries()) {
        entry.set(key, [...new Set(value)]);
      }
    }

    return result;
  }

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * 現場稼働予定ドキュメントの配列を、`groupKey` をキーとする Map に変換します。
   * - これにより、特定の `groupKey` に対応するドキュメントへの高速なアクセスが可能になります。
   * [groupKey]
   * - `siteId`、`shiftType`、`dateAt` を組み合わせた文字列で構成される一意の識別子
   * @returns {Map<string, Object>} `groupKey` をキーとする Map
   */
  const schedulesMap = Vue.computed(() => {
    const result = new Map();
    for (const schedule of schedules) {
      const groupKey = _createGroupKey(schedule);
      result.set(groupKey, schedule);
    }
    return result;
  });

  /**
   * 配置通知ドキュメントの配列を、`notificationKey` をキーとする Map に変換します。
   * - これにより、特定のドキュメント ID に対応するドキュメントへの高速なアクセスが可能になります。
   * [notificationKey]
   * - `siteOperationScheduleId` と `workerId` を組み合わせた文字列で構成される一意の識別子
   * @returns {Map<string, Object>} `notificationKey` をキーとする Map
   */
  const notificationsMap = Vue.computed(() => {
    const result = new Map();
    for (const notification of notifications) {
      const notificationKey = _createNotificationKey(notification);
      result.set(notificationKey, notification);
    }
    return result;
  });

  /**
   * 配置通知ドキュメントの配列を、`siteOperationScheduleId` をキーとする Map に変換します。
   * - これにより、特定の `siteOperationScheduleId` に対応するドキュメントへの高速なアクセスが可能になります。
   * [siteOperationScheduleId]
   * - 現場稼働予定ドキュメントの ID を表す文字列
   * @returns {Map<string, Object[]>} `siteOperationScheduleId` をキーとする Map
   */
  const notificationsByScheduleIdMap = Vue.computed(() => {
    const result = new Map();
    for (const notification of notifications) {
      const scheduleId = notification.siteOperationScheduleId;
      if (!result.has(scheduleId)) {
        result.set(scheduleId, []);
      }
      result.get(scheduleId).push(notification);
    }
    return result;
  });

  /**
   * Arranged Employees Map
   * @description 日付ごとおよび勤務区分ごとの配置済み従業員IDのマップ
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<employeeId: string>>>
   */
  const arrangedEmployeesMap = Vue.computed(() => {
    return _createArrangementMap(schedules, "employeeIds");
  });

  /**
   * Arranged Outsourcers Map
   * @description 日付ごとおよび勤務区分ごとの配置済み外注先IDのマップ
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<outsourcerId: string>>>
   */
  const arrangedOutsourcersMap = Vue.computed(() => {
    return _createArrangementMap(schedules, "outsourcerIds");
  });

  /**
   * 選択中の日付
   * - `OperationSchedulesTable` の `selectedDate` と双方向バインディングされる予定の状態です。
   * - `OperationSchedulesTable` 内で日付が選択されると、この状態が更新されます。
   * - `isEmployeeArranged` 関数はこの状態を参照して、指定された従業員IDが選択された日付の勤務区分に配置されているかどうかを判定します。
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
   * 指定された条件に一致する現場稼働予定ドキュメントを取得します。
   * @param {Object} options
   * @param {string} options.siteId - 現場 ID
   * @param {string} options.shiftType - シフト種別
   * @param {string} options.date - 日付文字列（YYYY-MM-DD）
   * @returns {Object|null} 指定された条件に一致する現場稼働予定ドキュメント、または見つからない場合は null
   */
  function getSchedule({ siteId, shiftType, date }) {
    const groupKey = _createGroupKey({ siteId, shiftType, date });
    return schedulesMap.value.get(groupKey) || null;
  }

  /**
   * 指定された条件に一致する配置通知ドキュメントを取得します。
   * @param {Object} options
   * @param {string} options.siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @param {string} options.workerId - 作業員 ID
   * @returns {Object|null} 指定された条件に一致する配置通知ドキュメント、または見つからない場合は null
   */
  function getNotification({ siteOperationScheduleId, workerId }) {
    const notificationKey = _createNotificationKey({
      siteOperationScheduleId,
      workerId,
    });
    return notificationsMap.value.get(notificationKey) || null;
  }

  /**
   * 指定された現場稼働予定ドキュメント ID に対応する配置通知ドキュメントの配列を取得します。
   * @param {string} siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @returns {Object[]} 指定された現場稼働予定ドキュメント ID に対応する配置通知ドキュメントの配列
   */
  function getNotificationsByScheduleId(siteOperationScheduleId) {
    return (
      notificationsByScheduleIdMap.value.get(siteOperationScheduleId) || []
    );
  }

  /**
   * 指定された現場稼働予定ドキュメント ID に対応する配置通知ドキュメントが存在するかどうかを判定します。
   * @param {string} siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @returns {boolean} 指定された現場稼働予定ドキュメント ID に対応する配置通知ドキュメントが存在する場合は true、そうでない場合は false
   */
  function hasNotificationForSchedule(siteOperationScheduleId) {
    return getNotificationsByScheduleId(siteOperationScheduleId).length > 0;
  }

  /**
   * 引数で指定された従業員IDが、選択された日付の指定された勤務区分に配置されているかどうかを判定します。
   * - internalSelectedDate が null または未設定の場合、false を返します。
   * - 指定された従業員IDが配置されている場合に true を返します。
   * - 配置されていない場合に false を返します。
   * @param {string} id - 従業員ID
   * @param {string} shiftType - 勤務区分（"allDay", "DAY", "NIGHT" のいずれか）
   * @returns {boolean} - 配置されている場合は true、そうでない場合は false
   */
  const isEmployeeArranged = (id, shiftType = "allDay") => {
    if (!internalSelectedDate.value) return false;
    const dateMap = arrangedEmployeesMap.value.get(internalSelectedDate.value);
    if (!dateMap) return false;
    const shiftTypeMap = dateMap.get(shiftType) || [];
    return shiftTypeMap.includes(id);
  };

  /**
   * 引数で指定されたスケジュールの配置通知を作成します。
   * @param {*} schedule - 配置通知を作成するスケジュールオブジェクト
   * @returns {Promise<void>}
   */
  const notify = async (schedule) => {
    const key = loadings.add(`Creating notifications`);
    try {
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadings.remove(key);
    }
  };

  /**
   * 引数で受け取ったスケジュールを更新します。
   * - `SiteOperationScheduleCard` の `update:schedule` イベントで使用される、
   *   作業員の追加・削除や順序変更をデータベースに反映するためのものです。
   * Note: 複数スケジュールの更新が必要な場合は、updateSchedules を使用します。
   *       updateSchedules を個別に呼び出すよりも効率的です。
   * @param {SiteOperationSchedule} schedule - 更新するスケジュールオブジェクト
   */
  const updateSchedule = async (schedule) => {
    // 開発モードの場合、更新前後の作業員IDリストをコンソールに表示
    if (isDev) {
      const before = schedule._beforeData.workers.map((w) => w.workerId);
      const after = schedule.workers.map((w) => w.workerId);
      console.table({ before, after });
    }
    try {
      await schedule.update();
    } catch (error) {
      logger.error({ message: "Failed to update schedule", error });
    }
  };

  /**
   * 引数で受け取った複数のスケジュールを一括で更新します。
   * - `DraggableOperationSchedules` の `update:schedules` イベントで使用される、
   *   複数スケジュールの更新をデータベースに反映するためのものです。
   *   `displayOrder` の変更を反映することを目的としています。
   * - トランザクションを使用して一括更新を行います。
   * @param {Array<SiteOperationSchedule>} schedules
   */
  const updateSchedules = async (schedules) => {
    try {
      await SiteOperationSchedule.runTransaction(async (transaction) => {
        const promises = schedules.map((schedule) =>
          schedule.update({ transaction }),
        );
        await Promise.all(promises);
      });
    } catch (error) {
      logger.error({ message: "Failed to update schedules", error });
    }
  };

  /**
   * 指定された日付の配置表PDFを生成して表示します。
   * - ローディング状態を管理し、PDF生成中はユーザーにフィードバックを提供します。
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

  // /**
  //  * 配置情報通知用のテキストを生成して返します。
  //  * @param {string} date - Date in 'YYYY-MM-DD' format
  //  * @returns {string} - Command text for the specified date
  //  */
  // const getCommandText = (date) => {
  //   const formattedDate = dayjs(date).locale(ja).format("YYYY年MM月DD日(ddd)");

  //   // Get schedules for the specified date
  //   const dayFilteredSchedules = schedules.filter(
  //     (schedule) => schedule.date === date,
  //   );
  //   if (dayFilteredSchedules.length === 0) {
  //     return `${formattedDate} 配置\n\n配置はありません。`;
  //   }

  //   const siteOrder = siteShiftTypeOrderComposable.siteShiftTypeOrder || [];

  //   // siteOrder順に並べ替え
  //   if (siteOrder.length > 0) {
  //     dayFilteredSchedules.sort((a, b) => {
  //       const aIdx = siteOrder.findIndex(
  //         (order) =>
  //           order.siteId === a.siteId && order.shiftType === a.shiftType,
  //       );
  //       const bIdx = siteOrder.findIndex(
  //         (order) =>
  //           order.siteId === b.siteId && order.shiftType === b.shiftType,
  //       );
  //       // siteOrderに含まれていない場合は後ろに
  //       if (aIdx === -1 && bIdx === -1) return 0;
  //       if (aIdx === -1) return 1;
  //       if (bIdx === -1) return -1;
  //       return aIdx - bIdx;
  //     });
  //   }

  //   const lines = dayFilteredSchedules.reduce((acc, schedule, index, arr) => {
  //     const site =
  //       fetchSiteComposable.cachedSites.value[schedule.siteId] || "N/A";
  //     const siteName = site ? site.name : "不明な現場";
  //     const siteAddress = site ? site.address : "";
  //     const shiftType =
  //       schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE.DAY.value
  //         ? "日勤"
  //         : "夜勤";
  //     const mark =
  //       schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE.DAY.value
  //         ? "○"
  //         : "●";
  //     const basicTimeRange = `${schedule.startTime}〜${schedule.endTime}`;
  //     const employees =
  //       schedule.employees
  //         .map((emp) => {
  //           const employee =
  //             fetchEmployeeComposable.cachedEmployees.value[emp.workerId];
  //           if (!employee) return `${mark}unknown`;
  //           return `${mark}${employee.displayName}${employee?.title || ""}`;
  //         })
  //         .join("\n") || "";
  //     const outsourcers =
  //       schedule.outsourcers
  //         .map((out) => {
  //           const outsourcer =
  //             fetchOutsourcerComposable.cachedOutsourcers.value[out.workerId];
  //           if (!outsourcer) return `${mark}unknown(${out.amount}名)`;
  //           return `${mark}${outsourcer.displayName}(${out.amount}名)`;
  //         })
  //         .join("\n") || "";
  //     acc.push(`【${siteName} - ${shiftType}】`);
  //     acc.push(siteAddress);
  //     acc.push(basicTimeRange);
  //     if (employees) acc.push(employees);
  //     if (outsourcers) acc.push(outsourcers);
  //     if (index !== arr.length - 1) {
  //       acc.push("\n");
  //     }
  //     return acc;
  //   }, []);

  //   return `${formattedDate} 配置\n\n` + lines.join("\n");
  // };

  return {
    /** COMPOSABLES: 後方互換 */
    siteShiftTypeReorderComposable,
    duplicatorComposable,

    /** DATA  */
    siteShiftTypeOrder: siteShiftTypeOrderComposable.siteShiftTypeOrder,
    arrangedEmployeesMap,
    arrangedOutsourcersMap,
    schedulesMap,
    notificationsMap,
    selectedDate,

    /** METHODS */
    isEmployeeArranged,
    notify,
    updateSchedule,
    updateSchedules,
    openPdf,
    getCommandText,
    removeSiteShiftTypeOrder: siteShiftTypeOrderComposable.remove,
    getSchedule,
    getNotification,
    getNotificationsByScheduleId,
    hasNotificationForSchedule,
  };
}
