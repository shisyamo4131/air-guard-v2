import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { useLogger } from "@/composables/useLogger";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useEmployeesInRange } from "@/composables/dataLayers/useEmployeesInRange";
import { useOutsourcersInRange } from "@/composables/dataLayers/useOutsourcersInRange";

/*****************************************************************************
 * @file ./composables/dataLayers/useArrangementsInRange.js
 * @description 配置管理用データレイヤーコンポーザブル
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 配置管理の開始日時を表す Ref
 * @param {Ref<Date>} options.to - 配置管理の終了日時を表す Ref
 * @returns {{
 *  schedules: Object[], // 現場稼働予定ドキュメントの配列
 *  notifications: Object[], // 配置通知ドキュメントの配列
 *  arrangedEmployeesMap: Ref<Map<string, Map<string, string[]>>>,
 *  arrangedOutsourcersMap: Ref<Map<string, Map<string, string[]>>>,
 *  selectableEmployees: Ref<Object[]>, // 選択可能な従業員ドキュメントの配列
 * selectableOutsourcers: Ref<Object[]>, // 選択可能な外注先ドキュメントの配列
 *  schedulesIndex: {
 *    byDocId: Ref<Map<string, Object>>,
 *    byDocId は主キーとして扱う現場稼働予定インデックスです。
 *    byGroupKey: Ref<Map<string, Object>>,
 *    byGroupKey は siteId / shiftType / date から作る派生インデックスです。
 *    groupKeyByScheduleId: Ref<Map<string, string>>,
 *    groupKeyByScheduleId は docId から直近の groupKey を引くための補助インデックスです。
 *  },
 *  notificationIndexes: {
 *    byDocId: Ref<Map<string, Object>>,
 *    byDocId は ArrangementNotification の docId を主キーとして扱います。
 *    byScheduleId: Ref<Map<string, Map<string, Object>>>,
 *    byScheduleId は siteOperationScheduleId でまとめて通知を引くための補助インデックスです。
 *  },
 *  getSchedule: Function, - `docId(scheduleId)` から現場稼働予定を引くための関数
 *  getScheduleByGroupKey: Function, - `groupKey` から現場稼働予定を引くための関数
 *  getNotification: Function, - `siteOperationScheduleId` と `workerId` から配置通知を引くための関数
 *  getNotificationsByScheduleId: Function, - `siteOperationScheduleId` から配置通知の配列を引くための関数
 *  hasNotificationForSchedule: Function, - `siteOperationScheduleId` から配置通知の有無を確認するための関数
 *  isEmployeeArranged: Function, - `employeeId` と `date` から配置済みかどうかを確認するための関数
 * }}
 *****************************************************************************/
export function useArrangementsInRange({ from, to } = {}) {
  const { isDev } = useAuthStore();

  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  if (!Vue.isRef(from) || !Vue.isRef(to)) {
    throw new TypeError(
      "Invalid 'from' or 'to' option. Both must be Ref<Date>.",
    );
  }

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useArrangementsInRange");
  const {
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  } = useFetch("useArrangementsInRange");
  const { fetchSite } = fetchSiteComposable;
  const { fetchEmployee } = fetchEmployeeComposable;
  const { fetchOutsourcer } = fetchOutsourcerComposable;

  /** selectableEmployees from useEmployeesInRange */
  const { docs: selectableEmployees } = useEmployeesInRange({ from, to });

  /** selectableOutsourcers from useOutsourcersInRange */
  const { docs: selectableOutsourcers } = useOutsourcersInRange({ from, to });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  /** SiteOperationSchedule インスタンス */
  const scheduleInstance = Vue.reactive(new SiteOperationSchedule());

  /** ArrangementNotification インスタンス */
  const arrangementNotificationInstance = Vue.reactive(
    new ArrangementNotification(),
  );

  /**
   * 現場稼働予定インデックス（docId）
   * - キー: SiteOperationSchedule の docId
   * - 値: SiteOperationSchedule ドキュメント
   * - 主キーとして扱うため、groupKey 変更の影響を受けません。
   */
  const schedulesByDocId = Vue.shallowRef(new Map());

  /**
   * 現場稼働予定インデックス（groupKey）
   * - キー: `${siteId}_${shiftType}_${date}`
   * - 値: SiteOperationSchedule ドキュメント
   * - 表示や検索用の派生キーとして使います。
   */
  const schedulesByGroupKey = Vue.shallowRef(new Map());

  /**
   * 現場稼働予定インデックス（docId -> groupKey）
   * - docId をキーに、直近の groupKey を保持します。
   * - groupKey が変わった際に旧キーを掃除するために使います。
   */
  const groupKeyByScheduleId = Vue.shallowRef(new Map());

  /**
   * 配置通知インデックス（docId）
   * - キー: ArrangementNotification の docId
   * - 値: ArrangementNotification ドキュメント
   * - docId は `${siteOperationScheduleId}_${workerId}` の composite key です。
   */
  const notificationsByDocId = Vue.shallowRef(new Map());

  /**
   * 配置通知インデックス（スケジュール）
   * - キー: siteOperationScheduleId
   * - 値: Map<notificationId, ArrangementNotification ドキュメント>
   * - 内部の Map のキーは ArrangementNotification ドキュメントの docId です。
   */
  const notificationsByScheduleId = Vue.shallowRef(new Map());

  /*****************************************************************************
   * METHODS (INTERNAL)
   *****************************************************************************/
  /**
   * 引数から `notificationKey` を生成して返します。
   * @param {ArrangementNotification} item
   * @returns {string} notificationKey
   */
  function _createNotificationKey(item) {
    return `${item.siteOperationScheduleId}_${item.workerId}`;
  }

  /**
   * 引数から `groupKey` を生成して返します。
   * @param {Object} item
   * @param {string} item.siteId - 現場 ID
   * @param {string} item.shiftType - シフト種別
   * @param {string} item.date - 日付文字列（YYYY-MM-DD）
   * @returns {string} groupKey
   */
  function _createScheduleGroupKey(item) {
    return `${item.siteId}_${item.shiftType}_${item.date}`;
  }

  /**
   * 日付ごとおよび勤務区分ごとの配置済みIDマップを生成します。
   * - 同じ日付の schedule をまとめて、allDay / DAY / NIGHT の各配置済み ID を集計します。
   * - data layer 内でのみ使う補助関数なので、外部には公開しません。
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

    for (const entry of result.values()) {
      for (const [key, value] of entry.entries()) {
        entry.set(key, [...new Set(value)]);
      }
    }

    return result;
  }

  /**
   * 現場稼働予定に対する従業員配置インデックス。
   * - 日付ごとおよび勤務区分ごとの配置済み従業員IDのマップです。
   * - `index.vue` などから直接参照される想定の公開 state です。
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<employeeId: string>>>
   */
  const arrangedEmployeesMap = Vue.computed(() => {
    return _createArrangementMap(scheduleInstance.docs, "employeeIds");
  });

  /**
   * 現場稼働予定に対する外注配置インデックス。
   * - 日付ごとおよび勤務区分ごとの配置済み外注先IDのマップです。
   * - `index.vue` などから直接参照される想定の公開 state です。
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<outsourcerId: string>>>
   */
  const arrangedOutsourcersMap = Vue.computed(() => {
    return _createArrangementMap(scheduleInstance.docs, "outsourcerIds");
  });

  /**
   * 指定された日付の指定勤務区分に、指定作業員が配置されているか判定します。
   * - `selectedDate` を前提に、選択中の日付の配置状況だけを判定します。
   * - `arrangedEmployeesMap` を参照する軽量な問い合わせ用 API です。
   * @param {Object} options
   * @param {string} options.date - YYYY-MM-DD 形式の日付
   * @param {string} options.id - 従業員 ID
   * @param {string} [options.shiftType="allDay"] - 勤務区分
   * @returns {boolean}
   */
  function isEmployeeArranged({ date, id, shiftType = "allDay" } = {}) {
    if (!date || !id) return false;
    const dateMap = arrangedEmployeesMap.value.get(date);
    if (!dateMap) return false;
    const shiftTypeMap = dateMap.get(shiftType) || [];
    return shiftTypeMap.includes(id);
  }

  /**
   * 指定された docId に一致する現場稼働予定ドキュメントを取得します。
   * - `schedulesByDocId` を参照する主 API です。
   * @param {string} docId - 現場稼働予定ドキュメントの ID
   * @returns {SiteOperationSchedule|null}
   */
  function getSchedule(docId) {
    return schedulesByDocId.value.get(docId) || null;
  }

  /**
   * 指定された groupKey に一致する現場稼働予定ドキュメントを取得します。
   * - `schedulesByGroupKey` を参照する検索用 API です。
   * - `siteId / shiftType / date` から作られる派生キーで 1 件取得します。
   * @param {string} groupKey - `${siteId}_${shiftType}_${date}` のキー
   * @returns {SiteOperationSchedule|null}
   */
  function getScheduleByGroupKey(groupKey) {
    return schedulesByGroupKey.value.get(groupKey) || null;
  }

  /**
   * 指定された条件に一致する配置通知ドキュメントを取得します。
   * - `ArrangementNotification` の composite docId を用いて 1 件取得します。
   * @param {Object} options
   * @param {string} options.siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @param {string} options.workerId - 作業員 ID
   * @returns {ArrangementNotification|null}
   */
  function getNotification({ siteOperationScheduleId, workerId }) {
    const notificationKey = _createNotificationKey({
      siteOperationScheduleId,
      workerId,
    });
    return notificationsByDocId.value.get(notificationKey) || null;
  }

  /**
   * 指定された現場稼働予定ドキュメント ID に対応する配置通知ドキュメントの配列を取得します。
   * - `siteOperationScheduleId` 配下の通知をまとめて扱いたい画面向けの API です。
   * @param {string} siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @returns {ArrangementNotification[]}
   */
  function getNotificationsByScheduleId(siteOperationScheduleId) {
    const notificationsMap = notificationsByScheduleId.value.get(
      siteOperationScheduleId,
    );
    if (!notificationsMap) return [];
    return [...notificationsMap.values()];
  }

  /**
   * 指定された現場稼働予定ドキュメント ID に対応する配置通知ドキュメントが存在するかどうかを判定します。
   * - 通知の存在有無だけを軽く確認したいケースで使います。
   * @param {string} siteOperationScheduleId - 現場稼働予定ドキュメントの ID
   * @returns {boolean}
   */
  function hasNotificationForSchedule(siteOperationScheduleId) {
    const notificationsMap = notificationsByScheduleId.value.get(
      siteOperationScheduleId,
    );
    return !!notificationsMap && notificationsMap.size > 0;
  }

  /**
   * 指定されたスケジュールIDと配置通知IDに基づいて、配置通知インデックス（スケジュール）から配置通知を削除します。
   * - 配置通知を削除した結果、スケジュールIDに紐づく配置通知がなくなった場合は、スケジュールID自体もインデックスから削除します。
   * @param {string} scheduleId - スケジュールID
   * @param {string} notificationId - 配置通知ID
   * @returns {void}
   */
  function removeFromScheduleIndex(scheduleId, notificationId) {
    const notificationsMap = notificationsByScheduleId.value.get(scheduleId);
    if (!notificationsMap) return;
    notificationsMap.delete(notificationId);
    if (notificationsMap.size === 0) {
      notificationsByScheduleId.value.delete(scheduleId);
    }
  }

  /**
   * 指定された配置通知ドキュメントに対して、インデックスの変更を適用します。
   * - `notificationsByDocId` と `notificationsByScheduleId` を同期させます。
   * - `subscribeDocs` から受け取る changeType をそのまま反映します。
   * @param {ArrangementNotification} item - 配置通知ドキュメント
   * @param {"added" | "modified" | "removed"} changeType - 変更タイプ
   * @returns {void}
   */
  function applyNotificationIndexChange(item, changeType) {
    const notificationId = item.docId;
    const scheduleId = item.siteOperationScheduleId;

    switch (changeType) {
      // 追加、変更時の処理
      case "added":
      case "modified": {
        // 配置通知インデックス（docId）を更新（既存は上書きになる）
        notificationsByDocId.value.set(notificationId, item);

        // 配置通知インデックス（スケジュール）が存在しない場合は Map を値として追加
        if (!notificationsByScheduleId.value.has(scheduleId)) {
          notificationsByScheduleId.value.set(scheduleId, new Map());
        }

        // 配置通知インデックス（スケジュール）を更新（既存は上書きになる）
        notificationsByScheduleId.value
          .get(scheduleId)
          .set(notificationId, item);
        break;
      }

      // 削除時の処理
      case "removed": {
        // 配置通知インデックス（docId）から削除
        notificationsByDocId.value.delete(notificationId);

        // 配置通知インデックス（スケジュール）から削除
        removeFromScheduleIndex(scheduleId, notificationId);
        break;
      }
      default:
        return;
    }

    Vue.triggerRef(notificationsByDocId);
    Vue.triggerRef(notificationsByScheduleId);
  }

  /**
   * 指定された現場稼働予定ドキュメントに対して、インデックスの変更を適用します。
   * - `docId` を主キー、`groupKey` を派生キーとして同期します。
   * - `groupKey` が変わった場合は旧キーを削除して整合性を保ちます。
   * @param {SiteOperationSchedule} item - 現場稼働予定ドキュメント
   * @param {"added" | "modified" | "removed"} changeType - 変更タイプ
   * @returns {void}
   */
  function applyScheduleIndexChange(item, changeType) {
    const scheduleId = item.docId;
    const groupKey = _createScheduleGroupKey(item);
    const previousGroupKey = groupKeyByScheduleId.value.get(scheduleId);

    switch (changeType) {
      case "removed": {
        schedulesByDocId.value.delete(scheduleId);
        if (previousGroupKey) {
          schedulesByGroupKey.value.delete(previousGroupKey);
        }
        groupKeyByScheduleId.value.delete(scheduleId);
        schedulesByGroupKey.value.delete(groupKey);
        break;
      }
      case "added":
      case "modified":
      default: {
        // changeType が未提供の実装でも破綻しないように set を既定動作にする
        schedulesByDocId.value.set(scheduleId, item);
        groupKeyByScheduleId.value.set(scheduleId, groupKey);
        if (previousGroupKey && previousGroupKey !== groupKey) {
          schedulesByGroupKey.value.delete(previousGroupKey);
        }
        schedulesByGroupKey.value.set(groupKey, item);
        break;
      }
    }

    Vue.triggerRef(schedulesByDocId);
    Vue.triggerRef(schedulesByGroupKey);
    Vue.triggerRef(groupKeyByScheduleId);
  }

  /*****************************************************************************
   * VALIDATORS
   *****************************************************************************/
  /**
   * `fromDate` と `toDate` の値が適切な Date インスタンスであることを検証します。
   * - `fromDate` が `toDate` より前であることも検証します。
   * @param {[Date, Date]} dateRange - `fromDate` と `toDate` の配列
   * @returns {void}
   * @throws {TypeError} `fromDate` または `toDate` が Date インスタンスでない場合にスローされます。
   * @throws {RangeError} `fromDate` が `toDate` より後の場合にスローされます。
   */
  function validateDateValues([fromDate, toDate]) {
    if (!(fromDate instanceof Date)) {
      throw new TypeError("Invalid 'from' value. Must be a Date instance.");
    }

    if (!(toDate instanceof Date)) {
      throw new TypeError("Invalid 'to' value. Must be a Date instance.");
    }

    if (fromDate > toDate) {
      throw new RangeError("'from' must be earlier than or equal to 'to'.");
    }
  }

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 指定された期間の現場稼働予定ドキュメントについて購読を開始します。
   * - 各インスタンスの `subscribe()` は直前に `unsubscribe()` を自動実行します。
   * - `subscribeDocs` のコールバック内で、関連する現場、従業員、外注先の情報をフェッチします。
   * - 既存の Map は再初期化してから再購読するため、期間切り替え時に古い値が残りません。
   * @param {[Date, Date]} dateRange - `from` と `to` の配列
   * @returns {void}
   */
  function subscribe([fromDate, toDate]) {
    validateDateValues([fromDate, toDate]);
    schedulesByDocId.value = new Map();
    schedulesByGroupKey.value = new Map();
    groupKeyByScheduleId.value = new Map();
    notificationsByDocId.value = new Map();
    notificationsByScheduleId.value = new Map();
    const constraints = [
      ["where", "dateAt", ">=", fromDate],
      ["where", "dateAt", "<=", toDate],
    ];
    try {
      scheduleInstance.subscribeDocs({ constraints }, (doc, changeType) => {
        applyScheduleIndexChange(doc, changeType);
        if (typeof fetchSite === "function") {
          fetchSite(doc.siteId);
        }
        if (typeof fetchEmployee === "function") {
          fetchEmployee(doc.employeeIds);
        }
        if (typeof fetchOutsourcer === "function") {
          fetchOutsourcer(doc.outsourcerIds);
        }
      });
      arrangementNotificationInstance.subscribeDocs(
        { constraints },
        (doc, changeType) => {
          applyNotificationIndexChange(doc, changeType);
          if (typeof fetchSite === "function") {
            fetchSite(doc.siteId);
          }
          if (typeof fetchEmployee === "function" && doc.isEmployee) {
            fetchEmployee(doc.id);
          }
          if (typeof fetchOutsourcer === "function" && !doc.isEmployee) {
            fetchOutsourcer(doc.id);
          }
        },
      );
    } catch (error) {
      logger.error({
        message: "Failed to subscribe with given 'from' and 'to' values.",
        error,
        data: { fromDate, toDate },
      });
      scheduleInstance.unsubscribe();
      arrangementNotificationInstance.unsubscribe();
    }
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * `from` と `to` の変更を監視して、期間が変更された際に `subscribe()` を呼び出します。
   * - `immediate: true` オプションにより、コンポーザブルの初期化時にも `subscribe()` が呼び出されます。
   */
  Vue.watch(
    [from, to],
    ([newFrom, newTo]) => {
      if (isDev) {
        const message = `'from' or 'to' changed. Subscribing with new values.`;
        logger.debug({ message, data: { newFrom, newTo } });
      }
      subscribe([newFrom, newTo]);
    },
    { immediate: true },
  );

  /*****************************************************************************
   * CLEANUP
   *****************************************************************************/
  // `useArrangementsInRange` のスコープが破棄されたときに購読も解放します。
  Vue.onScopeDispose(() => {
    scheduleInstance.unsubscribe();
    arrangementNotificationInstance.unsubscribe();
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    /** DATA */
    schedules: scheduleInstance.docs,
    notifications: arrangementNotificationInstance.docs,
    arrangedEmployeesMap,
    arrangedOutsourcersMap,
    selectableEmployees,
    selectableOutsourcers,

    /** INDEXES */
    schedulesIndex: {
      byDocId: schedulesByDocId,
      byGroupKey: schedulesByGroupKey,
      groupKeyByScheduleId,
    },

    /** NOTIFICATION INDEXES */
    notificationIndexes: {
      byDocId: notificationsByDocId,
      byScheduleId: notificationsByScheduleId,
    },

    // LOOKUPS
    getSchedule,
    getScheduleByGroupKey,
    getNotification,
    getNotificationsByScheduleId,
    hasNotificationForSchedule,
    isEmployeeArranged,
  };
}
