/*****************************************************************************
 * @file composables/dataLayers/dailyAttendance/useDailyAttendancesInRange.js
 * @description 指定期間のDailyAttendanceを取得する。
 *****************************************************************************/
import * as Vue from "vue";
import { DailyAttendance } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

/**
 * @param {Object} options
 * @param {import("vue").Ref<Date>} options.from
 * @param {import("vue").Ref<Date>} options.to
 * @param {boolean} [options.snapshot=false] - `true` の場合、Firestoreのリアルタイム購読ではなく、単発の取得を行う。
 * @throws {TypeError} - `from` または `to` が `Ref<Date>` ではない場合にスローされます。
 * @throws {RangeError} - `from` が `to` よりも後の日付である場合にスローされます。
 * @returns {{
 *   docs: import("vue").ComputedRef<DailyAttendance[]>
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
  if (!Vue.isRef(from) || !Vue.isRef(to)) {
    throw new TypeError(
      "Invalid 'from' or 'to' option. Both must be Ref<Date>.",
    );
  }

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useDailyAttendancesInRange", useErrorsStore());
  const loadingsStore = useLoadingsStore();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new DailyAttendance());
  const docs = Vue.ref([]);

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function validateDateValues([fromDate, toDate]) {
    if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
      throw new TypeError("'from' and 'to' must be Date instances.");
    }
    if (fromDate > toDate) {
      throw new RangeError("'from' must be earlier than or equal to 'to'.");
    }
  }

  function subscribe([fromDate, toDate]) {
    validateDateValues([fromDate, toDate]);

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
    validateDateValues([fromDate, toDate]);
    const loadingKey = loadingsStore.add("Fetching DailyAttendances...");
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
      loadingsStore.remove(loadingKey);
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
  };
}
