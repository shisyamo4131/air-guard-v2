import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useEmployeesInRange } from "@/composables/dataLayers/employee/useEmployeesInRange";
import { useOutsourcersInRange } from "@/composables/dataLayers/outsourcer/useOutsourcersInRange";
import { useSiteOperationSchedulesInRange } from "@/composables/dataLayers/siteOperationSchedule/useSiteOperationSchedulesInRange";
import { useArrangementNotificationsInRange } from "@/composables/dataLayers/arrangementNotification/useArrangementNotificationsInRange";
import { useSiteShiftTypeOrderEnriched } from "@/composables/dataLayers/siteShiftTypeOrder/useSiteShiftTypeOrderEnriched";
import { TYPE as ORDER_TYPE } from "@/composables/dataLayers/siteShiftTypeOrder/type";

/*****************************************************************************
 * @file ./composables/dataLayers/useArrangementsInRange.js
 * @description 配置管理用 Facade データレイヤーコンポーザブル
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 配置管理の開始日時を表す Ref
 * @param {Ref<Date>} options.to - 配置管理の終了日時を表す Ref
 * @returns {{
 *  schedules: Object[], // 現場稼働予定ドキュメントの配列
 *  notifications: Object[], // 配置通知ドキュメントの配列
 *  arrangedEmployeesMap: Ref<Map<string, Map<string, string[]>>>,
 *  arrangedOutsourcersMap: Ref<Map<string, Map<string, string[]>>>,
 *  selectableEmployees: Ref<Object[]>, // 選択可能な従業員ドキュメントの配列
 *  selectableOutsourcers: Ref<Object[]>, // 選択可能な外注先ドキュメントの配列
 *  siteShiftTypeOrder: Ref<Array<Object>>, // 現場勤務区分オーダーの配列（補完済み）
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
  /** selectableEmployees from useEmployeesInRange */
  const { docs: selectableEmployees } = useEmployeesInRange({ from, to });

  /** selectableOutsourcers from useOutsourcersInRange */
  const { docs: selectableOutsourcers } = useOutsourcersInRange({ from, to });

  /** SiteOperationSchedules from useSiteOperationSchedulesInRange */
  const { docs: schedules } = useSiteOperationSchedulesInRange({ from, to });

  /** ArrangementNotifications from useArrangementNotificationsInRange */
  const { docs: notifications } = useArrangementNotificationsInRange({
    from,
    to,
  });

  /** siteShiftTypeOrder from useSiteShiftTypeOrderEnriched */
  const { siteShiftTypeOrder } = useSiteShiftTypeOrderEnriched({
    type: ORDER_TYPE.ARRANGEMENT,
    enrichmentOrders: schedules,
  });

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/

  /**
   * 現場稼働予定インデックス（docId）
   * - キー: SiteOperationSchedule の docId
   * - 値: SiteOperationSchedule ドキュメント
   * - 主キーとして扱うため、groupKey 変更の影響を受けません。
   */
  const schedulesByDocId = Vue.computed(() => {
    const result = new Map();
    for (const schedule of schedules.value) {
      result.set(schedule.docId, schedule);
    }
    return result;
  });

  /**
   * 現場稼働予定インデックス（groupKey）
   * - キー: `${siteId}_${shiftType}_${date}`
   * - 値: SiteOperationSchedule ドキュメント
   * - 表示や検索用の派生キーとして使います。
   */
  const schedulesByGroupKey = Vue.computed(() => {
    const result = new Map();
    for (const schedule of schedules.value) {
      result.set(_createScheduleGroupKey(schedule), schedule);
    }
    return result;
  });

  /**
   * 現場稼働予定インデックス（docId -> groupKey）
   * - docId をキーに、直近の groupKey を保持します。
   * - groupKey が変わった際に旧キーを掃除するために使います。
   */
  const groupKeyByScheduleId = Vue.computed(() => {
    const result = new Map();
    for (const schedule of schedules.value) {
      result.set(schedule.docId, _createScheduleGroupKey(schedule));
    }
    return result;
  });

  /**
   * 配置通知インデックス（docId）
   * - キー: ArrangementNotification の docId
   * - 値: ArrangementNotification ドキュメント
   * - docId は `${siteOperationScheduleId}_${workerId}` の composite key です。
   */
  const notificationsByDocId = Vue.computed(() => {
    const result = new Map();
    for (const notification of notifications.value) {
      result.set(notification.docId, notification);
    }
    return result;
  });

  /**
   * 配置通知インデックス（スケジュール）
   * - キー: siteOperationScheduleId
   * - 値: Map<notificationId, ArrangementNotification ドキュメント>
   * - 内部の Map のキーは ArrangementNotification ドキュメントの docId です。
   */
  const notificationsByScheduleId = Vue.computed(() => {
    const result = new Map();
    for (const notification of notifications.value) {
      const scheduleId = notification.siteOperationScheduleId;
      if (!result.has(scheduleId)) {
        result.set(scheduleId, new Map());
      }
      result.get(scheduleId).set(notification.docId, notification);
    }
    return result;
  });

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
    return _createArrangementMap(schedules.value, "employeeIds");
  });

  /**
   * 現場稼働予定に対する外注配置インデックス。
   * - 日付ごとおよび勤務区分ごとの配置済み外注先IDのマップです。
   * - `index.vue` などから直接参照される想定の公開 state です。
   * @returns {Map} - Map<date: string, Map<shiftType: string, Array<outsourcerId: string>>>
   */
  const arrangedOutsourcersMap = Vue.computed(() => {
    return _createArrangementMap(schedules.value, "outsourcerIds");
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

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    /** DATA */
    schedules,
    notifications,
    arrangedEmployeesMap,
    arrangedOutsourcersMap,
    selectableEmployees,
    selectableOutsourcers,
    siteShiftTypeOrder, // 補完された現場勤務区分オーダー

    /** INDEXES */
    schedulesIndex: Vue.computed(() => {
      return {
        byDocId: schedulesByDocId.value,
        byGroupKey: schedulesByGroupKey.value,
        groupKeyByScheduleId: groupKeyByScheduleId.value,
      };
    }),

    /** NOTIFICATION INDEXES */
    notificationIndexes: Vue.computed(() => {
      return {
        byDocId: notificationsByDocId.value,
        byScheduleId: notificationsByScheduleId.value,
      };
    }),

    // LOOKUPS
    getSchedule,
    getScheduleByGroupKey,
    getNotification,
    getNotificationsByScheduleId,
    hasNotificationForSchedule,
    isEmployeeArranged,
  };
}
