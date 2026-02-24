/*****************************************************************************
 * ArrangementsManager 専用コンポーザブル
 * @dependsOn useFetchSite - サイト情報フェッチ用コンポーザブル
 * @dependsOn useFetchEmployee - 従業員情報フェッチ用コンポーザブル
 * @dependsOn useFetchOutsourcer - 外注先情報フェッチ用コンポーザブル
 * @dependsOn useDateRange - 日付範囲管理用コンポーザブル
 * @dependsOn useDocuments - ドキュメント購読用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
import { Employee, Outsourcer, SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "../composables/useLogger";
import { useDateRange } from "@/composables/useDateRange.js";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useDocuments } from "@/composables/dataLayers/useDocuments.js";
import { useSiteShiftTypeOrder } from "@/composables/dataLayers/useSiteShiftTypeOrder.js";
import { useSiteShiftTypeReorder } from "@/composables/useSiteShiftTypeReorder";
import { useSiteOperationScheduleDuplicator } from "@/composables/useSiteOperationScheduleDuplicator";
import { useArrangementSheetPdf } from "@/composables/pdf/useArrangementSheetPdf";

/**
 * @return {Object} - dateRangeComposable
 * @return {Object} - fetchSiteComposable
 * @return {Object} - fetchEmployeeComposable
 * @return {Object} - fetchOutsourcerComposable
 * @return {Object} - siteShiftTypeReorderComposable
 * @return {Object} - duplicatorComposable
 * @return {Object} - schedules
 * @return {Object} - notifications
 * @return {Object} - employees
 * @return {Object} - outsourcers
 * @return {Array}  - siteShiftTypeOrder
 * @return {Map}    - arrangedEmployeesMap
 * @return {Map}    - arrangedOutsourcersMap
 * @return {Map}    - keyMappedNotifications
 * @return {Object} - selectedDate
 * @return {Function} - isEmployeeArranged
 * @return {Function} - notify
 * @return {Function} - updateSchedule
 * @return {Function} - updateSchedules
 * @return {Function} - openPdf
 */
export function useIndex() {
  /**
   * SETUP STORES
   */
  const auth = useAuthStore();
  const isDev = Vue.computed(() => auth.isDev);
  const loadings = useLoadingsStore();

  /**
   * SETUP LOGGER
   */
  const logger = useLogger("ArrangementsManager");

  /**
   * SETUP STATES
   */
  const internalSelectedDate = Vue.ref(null); // コンポーネントで選択された日付文字列

  /**
   * Fetch Composables
   * @description キャッシュ用のフェッチコンポーザブル群
   */
  const fetchSiteComposable = useFetchSite();
  const fetchEmployeeComposable = useFetchEmployee();
  const fetchOutsourcerComposable = useFetchOutsourcer();

  /**
   * Date Range Composable
   * @description 管理画面で使用する日付範囲を管理
   * - 開始日は前日、終了日は6日後の7日間をデフォルトとする
   */
  const dateRangeComposable = useDateRange({
    baseDate: dayjs().tz("Asia/Tokyo").toDate(),
    dayCount: 7,
    offsetDays: -1,
  });

  /**
   * SiteOperationSchedule Documents
   * @description 指定された日付範囲内の SiteOperationSchedule ドキュメントを購読
   * - dateRangeComposable の日付範囲（デバウンス）に基づいて動的にクエリを更新
   * - fetchSiteComposable、fetchEmployeeComposable、fetchOutsourcerComposable を使用して関連データを事前取得
   * - useDocuments により Unmounted 時に自動で購読解除される
   * @returns {Array} siteOperationSchedules - Array of SiteOperationSchedule documents
   */
  const { docs: schedules } = useDocuments(
    "SiteOperationSchedule",
    {
      options: Vue.computed(() => {
        const from = dateRangeComposable.debouncedDateRange.value.from;
        const to = dateRangeComposable.debouncedDateRange.value.to;
        return [
          ["where", "dateAt", ">=", from],
          ["where", "dateAt", "<=", to],
        ];
      }),
      fetchAllOnEmpty: true, // `search` オプションが空の場合、全ドキュメントを取得
    },
    (doc) => {
      fetchSiteComposable.fetchSite(doc.siteId);
      fetchEmployeeComposable.fetchEmployee(doc.employeeIds);
      fetchOutsourcerComposable.fetchOutsourcer(doc.outsourcerIds);
    },
  );

  /**
   * Arrangement Notification Documents
   * @description 指定された日付範囲内の ArrangementNotification ドキュメントを購読
   * - dateRangeComposable の日付範囲（デバウンス）に基づいて動的にクエリを更新
   * - fetchSiteComposable、fetchEmployeeComposable、fetchOutsourcerComposable を使用して関連データを事前取得
   * - useDocuments により Unmounted 時に自動で購読解除される
   * @returns {Array} arrangementNotifications - Array of ArrangementNotification documents
   */
  const { docs: arrangementNotifications } = useDocuments(
    "ArrangementNotification",
    {
      options: Vue.computed(() => {
        const from = dateRangeComposable.debouncedDateRange.value.from;
        const to = dateRangeComposable.debouncedDateRange.value.to;
        return [
          ["where", "dateAt", ">=", from],
          ["where", "dateAt", "<=", to],
        ];
      }),
      fetchAllOnEmpty: true,
    },
    (doc) => {
      fetchSiteComposable.fetchSite(doc.siteId);
      fetchEmployeeComposable.fetchEmployee(doc.employeeIds);
      fetchOutsourcerComposable.fetchOutsourcer(doc.outsourcerIds);
    },
  );

  /**
   * Key Mapped Notifications
   * @description docId をキーとした ArrangementNotification ドキュメントのマップ
   * - キーは `{siteOperationScheduleId}-{workerId}` に該当します。
   * @returns {Map} - Map<docId: string, ArrangementNotification>
   */
  const keyMappedNotifications = Vue.computed(() => {
    return arrangementNotifications.reduce((acc, doc) => {
      acc.set(doc.docId, doc);
      return acc;
    }, new Map());
  });

  /**
   * Site Shift Type Order Composable
   * @description 現場勤務区分オーダーを管理
   */
  const siteShiftTypeOrderComposable = useSiteShiftTypeOrder({
    schedules,
    fetchSiteComposable,
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
   * Employee Documents
   * @description 在職中の従業員ドキュメントを購読
   * - fetchEmployeeComposable を使用して関連データを事前取得
   * - useDocuments により Unmounted 時に自動で購読解除される
   * @returns {Array} employees - Array of Employee documents
   *
   * Note: 期間中に在職している従業員に限定するべきかもしれないが、
   *       突然退職するなど、既に配置されている従業員が退職状態になった場合への対応が先か。
   *       指定期間中に選択可能な従業員リストを取得できるコンポーザブルを別途用意するか。
   */
  const { docs: employees } = useDocuments(
    "Employee",
    {
      options: Vue.computed(() => {
        return [["where", "employmentStatus", "==", Employee.STATUS_ACTIVE]];
      }),
      fetchAllOnEmpty: true,
    },
    (doc) => fetchEmployeeComposable.fetchEmployee(doc.docId),
  );

  /**
   * Outsourcer Documents
   * @description 契約中の外注先ドキュメントを購読
   * - fetchOutsourcerComposable を使用して関連データを事前取得
   * - useDocuments により Unmounted 時に自動で購読解除される
   * @returns {Array} outsourcers - Array of Outsourcer documents
   */
  const { docs: outsourcers } = useDocuments(
    "Outsourcer",
    {
      options: Vue.computed(() => {
        return [["where", "contractStatus", "==", Outsourcer.STATUS_ACTIVE]];
      }),
      fetchAllOnEmpty: true,
    },
    (doc) => fetchOutsourcerComposable.fetchOutsourcer(doc.docId),
  );

  /**
   * Arranged Employees Map
   * @description 日付ごとおよび勤務区分ごとの配置済み従業員IDのマップ
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<employeeId: string>>>
   */
  const arrangedEmployeesMap = Vue.computed(() => {
    const result = schedules.reduce((acc, schedule) => {
      const dateKey = schedule.date;
      if (!acc.has(dateKey)) {
        acc.set(
          dateKey,
          new Map([
            ["allDay", []],
            [SiteOperationSchedule.SHIFT_TYPE.DAY.value, []],
            [SiteOperationSchedule.SHIFT_TYPE.NIGHT.value, []],
          ]),
        );
      }
      const entry = acc.get(dateKey);
      entry.get("allDay").push(...(schedule.employeeIds || []));
      const shiftEmployees = entry.get(schedule.shiftType);
      if (shiftEmployees) {
        shiftEmployees.push(...(schedule.employeeIds || []));
      }
      return acc;
    }, new Map());

    // Remove duplicates for each array
    result.forEach((entry) => {
      [
        "allDay",
        SiteOperationSchedule.SHIFT_TYPE.DAY.value,
        SiteOperationSchedule.SHIFT_TYPE.NIGHT.value,
      ].forEach((key) => {
        entry.set(key, Array.from(new Set(entry.get(key))));
      });
    });
    return result;
  });

  /**
   * Arranged Outsourcers Map
   * @description 日付ごとおよび勤務区分ごとの配置済み外注先IDのマップ
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<outsourcerId: string>>>
   */
  const arrangedOutsourcersMap = Vue.computed(() => {
    const result = schedules.reduce((acc, schedule) => {
      const dateKey = schedule.date;
      if (!acc.has(dateKey)) {
        acc.set(
          dateKey,
          new Map([
            ["allDay", []],
            [SiteOperationSchedule.SHIFT_TYPE.DAY.value, []],
            [SiteOperationSchedule.SHIFT_TYPE.NIGHT.value, []],
          ]),
        );
      }
      const entry = acc.get(dateKey);
      entry.get("allDay").push(...(schedule.outsourcerIds || []));
      const shiftOutsourcers = entry.get(schedule.shiftType);
      if (shiftOutsourcers) {
        shiftOutsourcers.push(...(schedule.outsourcerIds || []));
      }
      return acc;
    }, new Map());

    // Remove duplicates for each array
    result.forEach((entry) => {
      [
        "allDay",
        SiteOperationSchedule.SHIFT_TYPE.DAY.value,
        SiteOperationSchedule.SHIFT_TYPE.NIGHT.value,
      ].forEach((key) => {
        entry.set(key, Array.from(new Set(entry.get(key))));
      });
    });
    return result;
  });

  /**
   * Duplicator Composable
   * @description 現場運用スケジュール複製用コンポーザブル
   */
  const duplicatorComposable = useSiteOperationScheduleDuplicator();

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

  /**
   * 配置表PDF作成コンポーザブル
   */
  const pdfComposable = useArrangementSheetPdf({
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  });

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

  /**
   * 配置情報通知用のテキストを生成して返します。
   * @param {string} date - Date in 'YYYY-MM-DD' format
   * @returns {string} - Command text for the specified date
   */
  const getCommandText = (date) => {
    const formattedDate = dayjs(date).locale(ja).format("YYYY年MM月DD日(ddd)");

    // Get schedules for the specified date
    const dayFilteredSchedules = schedules.filter(
      (schedule) => schedule.date === date,
    );
    if (dayFilteredSchedules.length === 0) {
      return `${formattedDate} 配置\n\n配置はありません。`;
    }

    const siteOrder = siteShiftTypeOrderComposable.siteShiftTypeOrder || [];

    // siteOrder順に並べ替え
    if (siteOrder.length > 0) {
      dayFilteredSchedules.sort((a, b) => {
        const aIdx = siteOrder.findIndex(
          (order) =>
            order.siteId === a.siteId && order.shiftType === a.shiftType,
        );
        const bIdx = siteOrder.findIndex(
          (order) =>
            order.siteId === b.siteId && order.shiftType === b.shiftType,
        );
        // siteOrderに含まれていない場合は後ろに
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }

    const lines = dayFilteredSchedules.reduce((acc, schedule, index, arr) => {
      const site =
        fetchSiteComposable.cachedSites.value[schedule.siteId] || "N/A";
      const siteName = site ? site.name : "不明な現場";
      const siteAddress = site ? site.address : "";
      const shiftType =
        schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE.DAY.value
          ? "日勤"
          : "夜勤";
      const mark =
        schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE.DAY.value
          ? "○"
          : "●";
      const basicTimeRange = `${schedule.startTime}〜${schedule.endTime}`;
      const employees =
        schedule.employees
          .map((emp) => {
            const employee =
              fetchEmployeeComposable.cachedEmployees.value[emp.workerId];
            if (!employee) return `${mark}unknown`;
            return `${mark}${employee.displayName}${employee?.title || ""}`;
          })
          .join("\n") || "";
      const outsourcers =
        schedule.outsourcers
          .map((out) => {
            const outsourcer =
              fetchOutsourcerComposable.cachedOutsourcers.value[out.workerId];
            if (!outsourcer) return `${mark}unknown(${out.amount}名)`;
            return `${mark}${outsourcer.displayName}(${out.amount}名)`;
          })
          .join("\n") || "";
      acc.push(`【${siteName} - ${shiftType}】`);
      acc.push(siteAddress);
      acc.push(basicTimeRange);
      if (employees) acc.push(employees);
      if (outsourcers) acc.push(outsourcers);
      if (index !== arr.length - 1) {
        acc.push("\n");
      }
      return acc;
    }, []);

    return `${formattedDate} 配置\n\n` + lines.join("\n");
  };

  return {
    /** COMPOSABLES: 後方互換 */
    dateRangeComposable,
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
    siteShiftTypeReorderComposable,
    duplicatorComposable,

    /** DATA  */
    schedules,
    notifications: arrangementNotifications,
    employees,
    outsourcers,
    siteShiftTypeOrder: siteShiftTypeOrderComposable.siteShiftTypeOrder,
    arrangedEmployeesMap,
    arrangedOutsourcersMap,
    keyMappedNotifications,
    selectedDate,

    /** METHODS */
    isEmployeeArranged,
    notify,
    updateSchedule,
    updateSchedules,
    openPdf,
    getCommandText,
  };
}
