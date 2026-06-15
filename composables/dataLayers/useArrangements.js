import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { useLogger } from "@/composables/useLogger";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/*****************************************************************************
 * @file ./composables/dataLayer/useArrangements.js
 * @description 配置管理用データレイヤーコンポーザブル
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 配置管理の開始日時を表す Ref
 * @param {Ref<Date>} options.to - 配置管理の終了日時を表す Ref
 * @returns {{
 *  schedules: Object[], // 現場稼働予定ドキュメントの配列
 *  notifications: Object[], // 配置通知ドキュメントの配列
 * }}
 *****************************************************************************/
export function useArrangements({ from, to } = {}) {
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
  const logger = useLogger("useArrangements");
  const {
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  } = useFetch("useArrangements");
  const { fetchSite } = fetchSiteComposable;
  const { fetchEmployee } = fetchEmployeeComposable;
  const { fetchOutsourcer } = fetchOutsourcerComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const scheduleInstance = Vue.reactive(new SiteOperationSchedule()); // SiteOperationSchedule インスタンス
  const arrangementNotificationInstance = Vue.reactive(
    new ArrangementNotification(),
  ); // ArrangementNotification インスタンス

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
   * @param {[Date, Date]} dateRange - `from` と `to` の配列
   * @returns {void}
   */
  function subscribe([fromDate, toDate]) {
    validateDateValues([fromDate, toDate]);
    const constraints = [
      ["where", "dateAt", ">=", fromDate],
      ["where", "dateAt", "<=", toDate],
    ];
    try {
      scheduleInstance.subscribeDocs({ constraints }, (doc) => {
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
      arrangementNotificationInstance.subscribeDocs({ constraints }, (doc) => {
        if (typeof fetchSite === "function") {
          fetchSite(doc.siteId);
        }
        if (typeof fetchEmployee === "function" && doc.isEmployee) {
          fetchEmployee(doc.id);
        }
        if (typeof fetchOutsourcer === "function" && !doc.isEmployee) {
          fetchOutsourcer(doc.id);
        }
      });
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
  Vue.onScopeDispose(() => {
    scheduleInstance.unsubscribe();
    arrangementNotificationInstance.unsubscribe();
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    schedules: scheduleInstance.docs,
    notifications: arrangementNotificationInstance.docs,
  };
}
