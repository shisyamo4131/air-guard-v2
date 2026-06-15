import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { Employee } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * @file ./composables/dataLayer/useEmployeesInRange.js
 * @description 従業員範囲用データレイヤーコンポーザブル
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 従業員範囲の開始日時を表す Ref
 * @param {Ref<Date>} options.to - 従業員範囲の終了日時を表す Ref
 * @returns {{
 *   docs: ComputedRef<Employee[]>
 * }}
 *****************************************************************************/
export function useEmployeesInRange({ from, to } = {}) {
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
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useEmployeesInRange");
  const { fetchEmployeeComposable } = useFetch("useEmployeesInRange");
  const { pushEmployee } = fetchEmployeeComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const activeEmployeeInstance = Vue.reactive(new Employee()); // 在職者用 Employee インスタンス
  const resignedEmployeeInstance = Vue.reactive(new Employee()); // 退職者用 Employee インスタンス

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 指定された期間の従業員ドキュメントについて購読を開始します。
   * - 各インスタンスの `subscribe()` は直前に `unsubscribe()` を自動実行します。
   * - `subscribeDocs` のコールバック内で、関連する従業員情報をフェッチします。
   * @param {[Date, Date]} dateRange - `from` と `to` の配列
   * @returns {void}
   */
  function subscribe([fromDate, toDate]) {
    validateDateValues([fromDate, toDate]);
    const activeConstraints = [
      ["where", "employmentStatus", "==", Employee.STATUS_ACTIVE],
      ["where", "dateOfHire", "<=", toDate],
    ];
    const resignedConstraints = [
      ["where", "employmentStatus", "==", Employee.STATUS_RESIGNED],
      ["where", "dateOfHire", "<=", toDate],
      ["where", "dateOfTermination", ">=", fromDate],
    ];
    try {
      activeEmployeeInstance.subscribeDocs(
        { constraints: activeConstraints },
        (doc) => {
          if (typeof pushEmployee === "function") {
            pushEmployee(doc);
          }
        },
      );
      resignedEmployeeInstance.subscribeDocs(
        { constraints: resignedConstraints },
        (doc) => {
          if (typeof pushEmployee === "function") {
            pushEmployee(doc);
          }
        },
      );
    } catch (error) {
      logger.error({
        message: "Failed to subscribe with given 'from' and 'to' values.",
        error,
        data: { fromDate, toDate },
      });
      activeEmployeeInstance.unsubscribe();
      resignedEmployeeInstance.unsubscribe();
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
   * COMPUTED
   *****************************************************************************/
  const docs = Vue.computed(() => {
    const map = new Map();
    for (const doc of activeEmployeeInstance.docs) {
      map.set(doc.docId, doc);
    }
    for (const doc of resignedEmployeeInstance.docs) {
      map.set(doc.docId, doc);
    }
    return [...map.values()];
  });

  /*****************************************************************************
   * CLEANUP
   *****************************************************************************/
  Vue.onScopeDispose(() => {
    activeEmployeeInstance.unsubscribe();
    resignedEmployeeInstance.unsubscribe();
  });

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    docs,
  };
}
