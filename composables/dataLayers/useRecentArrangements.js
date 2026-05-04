/*****************************************************************************
 * @file ./composables/dataLayer/useRecentArrangements.js
 * @description A composable to providing recent `ArrangementNotification` documents.
 *****************************************************************************/
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useDateRange } from "@/composables/useDateRange";
import { useFetch } from "@/composables/fetch/useFetch";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * 指定された期間（日数）の配置通知ドキュメントを取得して返します。
 * - 認証ストアで取得した `employeeId` に該当する配置通知ドキュメントのみを取得します。
 * - 認証ストアで `employeeId` が取得できない場合は空の配列を返します。
 * - 取得期間の開始日は前日になります。
 * - `useFetch` の起点コンポーザブルです。
 * @param {Object} options
 * @param {number} options.dayCount - 取得する配置通知ドキュメントの期間（日数）。デフォルトは5日。
 * @returns {Object} - 配置通知ドキュメントの配列を含むオブジェクト。
 */
export function useRecentArrangements({ dayCount = 5 } = {}) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  /**
   * 認証ストアから `employeeId` を取得。
   * - `employeeId` が取得できなければ `docs` は空の配列として返す。
   */
  const auth = useAuthStore();
  const { employeeId } = auth;

  if (!employeeId) return { docs: [] };

  /**
   * 配置通知ドキュメントの取得範囲を設定するための `dateRange` を生成。
   */
  const { dateRange } = useDateRange({
    dayCount,
    offsetDays: -1, // 開始日は前日から
  });

  /**
   * fetchComposable の呼び出し。
   */
  const { fetchSiteComposable } = useFetch("useRecentArrangements", true);

  /**
   * 配置通知ドキュメントの取得
   */
  const { docs } = useDocuments(
    "ArrangementNotification",
    {
      options: computed(() => [
        ["where", "id", "==", employeeId],
        ["where", "dateAt", ">=", dateRange.value.from],
        ["where", "dateAt", "<=", dateRange.value.to],
      ]),
      fetchAllOnEmpty: true,
    },
    (doc) => fetchSiteComposable.fetchSite(doc),
  );

  return { docs };
}
