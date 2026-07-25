import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { Outsourcer } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetch } from "@/composables/fetch/useFetch";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/*****************************************************************************
 * @file ./composables/dataLayers/outsourcer/useOutsourcersInRange.js
 * @description 外注先範囲用データレイヤーコンポーザブル
 * [NOTE]
 * - `useEmployeesInRange` と同様の構造で実装していますが、2026-06-15 現在、外注先には
 *   契約の開始や終了といった日時データが存在しないため、期間に基づくフィルタリングは行っていません。
 *   純粋な「契約中外注先の購読」コンポーザブルとして機能します。
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 外注先範囲の開始日時を表す Ref（現在は使用されていませんが、将来的な拡張のために保持しています）
 * @param {Ref<Date>} options.to - 外注先範囲の終了日時を表す Ref（現在は使用されていませんが、将来的な拡張のために保持しています）
 * @returns {{
 *   docs: ComputedRef<Outsourcer[]>
 * }}
 *****************************************************************************/
export function useOutsourcersInRange({ from, to } = {}) {
  const { isDev } = useAuthStore();

  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  /** Validate `from` and `to` are Ref<Date>. */
  rangeIsRef({ from, to });

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useOutsourcersInRange");
  const { fetchOutsourcerComposable } = useFetch("useOutsourcersInRange");
  const { pushOutsourcer } = fetchOutsourcerComposable;

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const outsourcerInstance = Vue.reactive(new Outsourcer()); // Outsourcer インスタンス

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 指定された期間の外注先ドキュメントについて購読を開始します。
   * - 各インスタンスの `subscribe()` は直前に `unsubscribe()` を自動実行します。
   * - `subscribeDocs` のコールバック内で、関連する外注先情報をフェッチします。
   * @param {[Date, Date]} dateRange - `from` と `to` の配列
   * @returns {void}
   */
  function subscribe([fromDate, toDate]) {
    /** Validate `fromDate` and `toDate` are valid Date instances and `fromDate` is not later than `toDate`. */
    rangeIsValid({ from: fromDate, to: toDate });

    const activeConstraints = [
      ["where", "contractStatus", "==", Outsourcer.STATUS_ACTIVE],
    ];
    try {
      outsourcerInstance.subscribeDocs(
        { constraints: activeConstraints },
        (doc) => {
          if (typeof pushOutsourcer === "function") {
            pushOutsourcer(doc);
          }
        },
      );
    } catch (error) {
      logger.error({
        message: "Failed to subscribe with given 'from' and 'to' values.",
        error,
        data: { fromDate, toDate },
      });
      outsourcerInstance.unsubscribe();
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
    for (const doc of outsourcerInstance.docs) {
      map.set(doc.docId, doc);
    }
    return [...map.values()];
  });

  /*****************************************************************************
   * CLEANUP
   *****************************************************************************/
  Vue.onScopeDispose(() => {
    outsourcerInstance.unsubscribe();
  });

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    docs,
  };
}
