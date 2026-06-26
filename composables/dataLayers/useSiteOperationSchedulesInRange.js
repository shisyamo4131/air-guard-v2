import * as Vue from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * @function useSiteOperationSchedulesInRange
 * @description 指定期間内の SiteOperationSchedule インスタンスの配列を返すコンポーザブル
 * - `startDate` と `endDate` の範囲に含まれる SiteOperationSchedule インスタンスを取得します。
 * - 取得したインスタンスは `docs` プロパティとして返されます。
 * - `startDate` と `endDate` は Vue の Ref である必要があります。
 * @param {Object} options - オプションオブジェクト
 * @param {Vue.Ref<string>} options.startDate - 取得する期間の開始日を保持する参照
 * @param {Vue.Ref<string>} options.endDate - 取得する期間の終了日を保持する参照
 * @returns {Array<SiteOperationSchedule>} - 指定期間内の SiteOperationSchedule インスタンスの配列
 *****************************************************************************/
export function useSiteOperationSchedulesInRange({ startDate, endDate } = {}) {
  /*****************************************************************************
   * SETUP LOGGER COMPOSABLE
   *****************************************************************************/
  const logger = useLogger(
    "useSiteOperationSchedulesInRange",
    useErrorsStore(),
  );

  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  if (!startDate || !endDate) {
    const message = "Start date and end date must be provided.";
    logger.error({ message });
  }

  if (!Vue.isRef(startDate) || !Vue.isRef(endDate)) {
    const message = "Start date and end date must be Vue refs.";
    logger.error({ message });
  }

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function subscribe() {
    const from = Vue.unref(startDate);
    const to = Vue.unref(endDate);
    if (!from || !to) {
      const message =
        "Start date and end date must be provided. Subscription cannot proceed.";
      logger.error({ message });
      return;
    }

    instance.subscribeDocs({
      constraints: [
        ["where", "dateAt", ">=", from],
        ["where", "dateAt", "<=", to],
      ],
    });
  }

  function unsubscribe() {
    instance.unsubscribe();
  }

  /*****************************************************************************
   * CLEANUP
   *****************************************************************************/
  Vue.onScopeDispose(unsubscribe);

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch([startDate, endDate], subscribe, { immediate: true });

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return instance.docs;
}
