/*****************************************************************************
 * @file ./composables/dataLayers/employee/useEmployeesInRange.js
 * @description 期間内在籍従業員 取得用 データレイヤーコンポーザブル
 * - `from` と `to` の期間内に在籍している従業員インスタンスの配列を返します。
 * - `employmentStatus` が `ACTIVE` である従業員と、`RESIGNED` である従業員の両方を
 *   別々に取得する必要があるため、2つの `Employee` インスタンスを使用して購読（または取得）を行います。
 *****************************************************************************/
import * as Vue from "vue";
import { Employee } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetch } from "@/composables/fetch/useFetch";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/*****************************************************************************
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 従業員範囲の開始日時を表す Ref
 * @param {Ref<Date>} options.to - 従業員範囲の終了日時を表す Ref
 * @param {boolean} [options.snapshot=false] - true の場合、購読ではなく一度だけフェッチします。
 * @returns {{docs: ComputedRef<Employee[]>, loading: Ref<boolean>}} - 取得した従業員ドキュメントの配列と、ロード中かどうかを示す Ref
 *****************************************************************************/
export function useEmployeesInRange({ from, to, snapshot = false } = {}) {
  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  /** Validate `from` and `to` are Ref<Date>. */
  rangeIsRef({ from, to });

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useEmployeesInRange", useErrorsStore());
  const { fetchEmployeeComposable } = useFetch("useEmployeesInRange");
  const { pushEmployee, pushEmployees } = fetchEmployeeComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const activeEmployeeInstance = Vue.reactive(new Employee()); // 在職者用 Employee インスタンス
  const resignedEmployeeInstance = Vue.reactive(new Employee()); // 退職者用 Employee インスタンス
  const fetchedDocs = Vue.ref([]);
  const loading = Vue.ref(false); // `true` の場合、データの取得中であることを表します。（snapshot モードでのフェッチ中に使用）

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
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

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
        (doc) => pushEmployee(doc),
      );
      resignedEmployeeInstance.subscribeDocs(
        { constraints: resignedConstraints },
        (doc) => pushEmployee(doc),
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

  async function fetch([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

    const activeConstraints = [
      ["where", "employmentStatus", "==", Employee.STATUS_ACTIVE],
      ["where", "dateOfHire", "<=", toDate],
    ];
    const resignedConstraints = [
      ["where", "employmentStatus", "==", Employee.STATUS_RESIGNED],
      ["where", "dateOfHire", "<=", toDate],
      ["where", "dateOfTermination", ">=", fromDate],
    ];

    loading.value = true;
    try {
      const activeDocs = await activeEmployeeInstance.fetchDocs({
        constraints: activeConstraints,
      });
      const resignedDocs = await resignedEmployeeInstance.fetchDocs({
        constraints: resignedConstraints,
      });
      fetchedDocs.value = [...activeDocs, ...resignedDocs];
      pushEmployees(fetchedDocs.value);
    } catch (error) {
      logger.error({
        message: "Failed to fetch with given 'from' and 'to' values.",
        error,
        data: { fromDate, toDate },
      });
      activeEmployeeInstance.unsubscribe();
      resignedEmployeeInstance.unsubscribe();
    } finally {
      loading.value = false;
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
    async ([newFrom, newTo]) => {
      if (snapshot) {
        await fetch([newFrom, newTo]);
      } else {
        subscribe([newFrom, newTo]);
      }
    },
    { immediate: true },
  );

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const docs = Vue.computed(() => {
    if (snapshot) {
      return fetchedDocs.value;
    } else {
      const map = new Map();
      for (const doc of activeEmployeeInstance.docs) {
        map.set(doc.docId, doc);
      }
      for (const doc of resignedEmployeeInstance.docs) {
        map.set(doc.docId, doc);
      }
      return [...map.values()];
    }
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
  return { docs, loading };
}
