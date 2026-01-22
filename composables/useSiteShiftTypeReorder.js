/*****************************************************************************
 * 現場オーダー並び替え用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useBaseManager } from "@/composables/useBaseManager";

/**
 * @param {*} options
 * @param {import('vue').Ref<Array>} options.items - 現場オーダー配列の ref
 * @param {Function} options.onUpdate - 更新処理のコールバック関数
 * @returns {Object} return - コンポーザブルの戻り値
 * @returns {import('vue').ComputedRef<Object>} attrs - コンポーネント用 attrs
 * @returns {import('vue').Ref<boolean>} dialog - ダイアログ用の ref
 * @returns {Function} open - ダイアログを開く関数
 */
export function useSiteShiftTypeReorder({ items, onUpdate }) {
  /**
   * useBaseManager
   */
  const { logger, isLoading } = useBaseManager("useSiteShiftTypeReorder");

  /**
   * ダイアログ用の ref
   */
  const dialog = Vue.ref(false);

  /**
   * ダイアログを開く関数
   */
  const open = () => {
    dialog.value = true;
  };

  /**
   * submit イベントハンドラ
   * @param {*} newValue - 更新後の現場オーダー配列
   */
  const handlerSubmit = async (newValue) => {
    isLoading.value = true;
    try {
      if (onUpdate && typeof onUpdate === "function") {
        await onUpdate(newValue);
      }
      dialog.value = false;
    } catch (error) {
      logger.error({ error });
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * cancel イベントハンドラ
   */
  const handlerCancel = () => {
    dialog.value = false;
  };

  /**
   * コンポーネント用 attrs
   */
  const attrs = Vue.computed(() => {
    return {
      items: items.value,
      loading: isLoading.value,
      onSubmit: handlerSubmit,
      onCancel: handlerCancel,
    };
  });

  return {
    attrs,
    dialog,
    open,
  };
}
