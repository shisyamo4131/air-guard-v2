/*****************************************************************************
 * @file ./composables/application/operationResult/useDuplicate.js
 * @description 稼働実績ドキュメントを複製するためのメソッドを提供します。
 *****************************************************************************/
import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { duplicate as duplicateOperationResult } from "@/composables/domain/operationResult/duplicate";

export function useDuplicate() {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("operationResult/useDuplicate", useErrorsStore());
  const loadingsStore = useLoadingsStore();
  const loading = Vue.ref(false);

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * `source` に指定された稼働実績ドキュメントを、`dates` で指定された日付に複製します。
   * @param {{ source: OperationResult, dates: Date[]|string[] }} params
   * @param {OperationResult} params.source - 複製元の稼働実績ドキュメント
   * @param {Date[]|string[]} params.dates - 複製先の日付の配列
   * @returns {Promise<OperationResult[]|null>} - 複製された稼働実績ドキュメントの配列、またはエラー時は `null`
   */
  async function duplicate({ source, dates = [] } = {}) {
    const key = loadingsStore.add({ text: "Duplicating operation result..." });
    loading.value = true;
    try {
      const instances = await duplicateOperationResult({ source, dates });
      return instances;
    } catch (error) {
      logger.error({ error });
      return null;
    } finally {
      loadingsStore.remove(key);
      loading.value = false;
    }
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return { duplicate, loading };
}
