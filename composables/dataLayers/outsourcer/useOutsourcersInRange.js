import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { Outsourcer } from "@/schemas";
import { useSystemStore } from "@/stores/useSystemStore";
import { useFetch } from "@/composables/fetch/useFetch";
import {
  rangeIsRef,
  rangeIsValid,
} from "@/composables/validators/rangeValidator";

/*****************************************************************************
 * @file ./composables/dataLayers/outsourcer/useOutsourcersInRange.js
 * @description 外注先範囲用データレイヤーコンポーザブル
 * [NOTE]
 * - 外注先には契約の開始や終了といった日時データが存在せず、`contractStatus` は
 *   検索・配置・選択を制限しない表示上のフラグです。期間や状態では絞り込みません。
 * @param {Object} options - コンポーザブルのオプション
 * @param {Ref<Date>} options.from - 外注先範囲の開始日時を表す Ref（現在は使用されていませんが、将来的な拡張のために保持しています）
 * @param {Ref<Date>} options.to - 外注先範囲の終了日時を表す Ref（現在は使用されていませんが、将来的な拡張のために保持しています）
 * @returns {{
 *   docs: ComputedRef<Outsourcer[]>
 * }}
 *****************************************************************************/
export function useOutsourcersInRange({ from, to } = {}) {
  const { isDev } = useSystemStore();

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

    try {
      outsourcerInstance.subscribeDocs(
        { constraints: [] },
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
