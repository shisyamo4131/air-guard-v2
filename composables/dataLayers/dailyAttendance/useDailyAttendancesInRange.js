/*****************************************************************************
 * @file composables/dataLayers/dailyAttendance/useDailyAttendancesInRange.js
 * @description 指定期間のDailyAttendanceを取得する。
 *****************************************************************************/
import * as Vue from "vue";
import { DailyAttendance } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/**
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @param {boolean} [options.snapshot=false] - `true` の場合、Firestoreのリアルタイム購読ではなく、単発の取得を行う。
 * @throws {TypeError} - `from` または `to` が `Ref<Date>` ではない場合にスローされます。
 * @throws {RangeError} - `from` が `to` よりも後の日付である場合にスローされます。
 * @returns {{
 *   docs: import("vue").ComputedRef<DailyAttendance[]>,
 *   loading: import("vue").Ref<boolean>
 * }}
 */
export function useDailyAttendancesInRange({
  from,
  to,
  snapshot = false,
} = {}) {
  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  /** Validate `from` and `to` are Ref<Date>. */
  rangeIsRef({ from, to });

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useDailyAttendancesInRange", useErrorsStore());

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new DailyAttendance());
  const docs = Vue.ref([]);
  const loading = Vue.ref(false); // `true` の場合、データの取得中であることを表します。（snapshot モードでのフェッチ中に使用）

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

    try {
      docs.value = instance.subscribeDocs({
        constraints: [
          ["where", "dateAt", ">=", fromDate],
          ["where", "dateAt", "<=", toDate],
        ],
      });
    } catch (error) {
      logger.error({
        message: "Failed to subscribe DailyAttendances.",
        error,
        data: { fromDate, toDate },
      });
      instance.unsubscribe();
    }
  }

  async function fetch([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

    loading.value = true;
    try {
      docs.value = await instance.fetchDocs({
        constraints: [
          ["where", "dateAt", ">=", fromDate],
          ["where", "dateAt", "<=", toDate],
        ],
      });
    } catch (error) {
      logger.error({
        message: "Failed to fetch DailyAttendances.",
        error,
        data: { fromDate, toDate },
      });
    } finally {
      loading.value = false;
    }
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(
    [from, to],
    async ([fromDate, toDate]) => {
      if (snapshot) {
        await fetch([fromDate, toDate]);
      } else {
        subscribe([fromDate, toDate]);
      }
    },
    {
      immediate: true,
    },
  );

  /*****************************************************************************
   * LIFECYCLE HOOKS
   *****************************************************************************/
  Vue.onScopeDispose(() => instance.unsubscribe());

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    docs: Vue.computed(() => [...docs.value]),
    loading,
  };
}
