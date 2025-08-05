import { ref, watch, toRaw, unref } from "vue";
import { useErrorHandler } from "./useErrorHandler";

/**
 * 楽観的更新を管理する汎用コンポーザブル
 * @param {Object} options - オプション設定
 * @param {Array|Ref} options.data - 元データ
 * @param {Function} options.getItemId - アイテムIDを取得する関数 (item) => id
 * @param {String} options.contextName - エラーハンドリング用のコンテキスト名
 * @returns {Object} 楽観的更新機能
 */
export function useOptimisticUpdates({
  data,
  getItemId = (item) => item?.id || item?.docId,
  contextName = "useOptimisticUpdates",
} = {}) {
  /** エラーハンドラーの初期化 */
  const errorHandler = useErrorHandler(contextName);

  /** ローカル状態（楽観的更新用） */
  const localData = ref([]);
  const pendingUpdates = ref(new Set()); // 更新中のアイテムID
  const optimisticUpdates = ref(new Map()); // 楽観的更新の履歴

  /**
   * 元データをローカル状態に同期
   */
  watch(
    data,
    (newData) => {
      const resolvedData = unref(newData);

      if (Array.isArray(resolvedData)) {
        localData.value = [...resolvedData];
        clearCompletedUpdates(resolvedData);
      }
    },
    { immediate: true, deep: true }
  );

  /**
   * 完了した楽観的更新をクリア
   */
  function clearCompletedUpdates(freshData) {
    const freshIds = new Set(freshData.map(getItemId));

    // 削除された楽観的更新をクリア
    for (const [itemId] of optimisticUpdates.value) {
      if (!freshIds.has(itemId)) {
        optimisticUpdates.value.delete(itemId);
        pendingUpdates.value.delete(itemId);
      }
    }
  }

  /**
   * 楽観的更新：アイテムを即座にローカル状態に反映
   */
  const optimisticUpdate = (itemId, updateFn) => {
    try {
      if (!itemId || typeof updateFn !== "function") {
        throw new Error("Invalid itemId or updateFn");
      }

      const itemIndex = localData.value.findIndex(
        (item) => getItemId(item) === itemId
      );

      if (itemIndex !== -1) {
        const originalItem = toRaw(localData.value[itemIndex]);
        const updatedItem = updateFn(originalItem);

        if (!updatedItem) {
          throw new Error("UpdateFn must return a valid item object");
        }

        // 楽観的更新を記録
        optimisticUpdates.value.set(itemId, {
          original: originalItem,
          updated: updatedItem,
          timestamp: Date.now(),
        });

        // ローカル状態を即座に更新
        localData.value[itemIndex] = updatedItem;
        pendingUpdates.value.add(itemId);

        return updatedItem;
      }

      return null;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "楽観的更新",
        details: `itemId: ${itemId}`,
      });
      return null;
    }
  };

  /**
   * アイテムを追加（楽観的更新）
   */
  const addOptimistically = (
    newItem,
    tempIdGenerator = () => `temp_${Date.now()}_${Math.random()}`
  ) => {
    try {
      if (!newItem || typeof newItem !== "object") {
        throw new Error("New item must be a valid object");
      }

      const tempId = tempIdGenerator();
      const itemWithTempId = { ...newItem, [getItemId.name || "id"]: tempId };

      localData.value.push(itemWithTempId);
      pendingUpdates.value.add(tempId);

      return itemWithTempId;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "楽観的追加",
      });
      return null;
    }
  };

  /**
   * アイテムを削除（楽観的更新）
   */
  const removeOptimistically = (itemId) => {
    try {
      if (!itemId) {
        throw new Error("ItemId is required");
      }

      const itemIndex = localData.value.findIndex(
        (item) => getItemId(item) === itemId
      );

      if (itemIndex !== -1) {
        const removedItem = localData.value[itemIndex];
        localData.value.splice(itemIndex, 1);
        pendingUpdates.value.add(itemId);

        return removedItem;
      }

      return null;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "楽観的削除",
        details: `itemId: ${itemId}`,
      });
      return null;
    }
  };

  /**
   * 複数アイテムを一括更新
   */
  const batchUpdate = (items, filterFn) => {
    try {
      if (!Array.isArray(items)) {
        throw new Error("Items must be an array");
      }

      if (typeof filterFn !== "function") {
        throw new Error("FilterFn must be a function");
      }

      // フィルター条件に該当しないアイテムを保持
      const otherItems = localData.value.filter((item) => !filterFn(item));

      // 新しいアイテムと結合
      localData.value = [...otherItems, ...items];

      return true;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "一括更新",
        details: `items: ${items?.length}`,
      });
      return false;
    }
  };

  /**
   * 更新の完了を通知
   */
  const markUpdateComplete = (itemId) => {
    pendingUpdates.value.delete(itemId);
    optimisticUpdates.value.delete(itemId);
  };

  /**
   * 楽観的更新をロールバック
   */
  const rollbackOptimisticUpdate = (itemId) => {
    const update = optimisticUpdates.value.get(itemId);

    if (update) {
      const itemIndex = localData.value.findIndex(
        (item) => getItemId(item) === itemId
      );

      if (itemIndex !== -1) {
        localData.value[itemIndex] = update.original;
      }

      optimisticUpdates.value.delete(itemId);
      pendingUpdates.value.delete(itemId);
    }
  };

  /**
   * 全ての楽観的更新をロールバック
   */
  const rollbackAllOptimisticUpdates = () => {
    for (const itemId of optimisticUpdates.value.keys()) {
      rollbackOptimisticUpdate(itemId);
    }
  };

  /**
   * アイテムが更新中かどうかを確認
   */
  const isPending = (itemId) => {
    return pendingUpdates.value.has(itemId);
  };

  return {
    // 状態
    localData,
    pendingUpdates,
    optimisticUpdates,

    // 楽観的更新操作
    optimisticUpdate,
    addOptimistically,
    removeOptimistically,
    batchUpdate,

    // 更新管理
    markUpdateComplete,
    rollbackOptimisticUpdate,
    rollbackAllOptimisticUpdates,
    isPending,

    // ユーティリティ
    errorHandler,
  };
}
