import { ref } from "vue";
import { defineStore } from "pinia";

/**
 * useLoadingsStore
 * アプリ全体で共有するローディングメッセージキューを提供するストア。
 * Provides a global loading message queue shared across the application.
 * AirLoadingDialog と組み合わせて、複数処理の進行状況を一括管理します。
 * Use with AirLoadingDialog to display progress from multiple async processes.
 */
export const useLoadingsStore = defineStore("loadings", () => {
  // グローバルなローディングキュー
  // Global loading message queue
  const queue = ref([]);

  /**
   * メッセージをキューに追加します。
   * Add a message to the queue.
   * @param {{ key?: string, text: string }} message - 表示するメッセージオブジェクト / Message object to be displayed
   * @returns {string} - 追加されたメッセージのキー / Key of the added message
   */
  function add(message) {
    const text = message?.text || message || undefined;
    // if (!message?.text) return null;
    if (!text) return null;

    // keyが指定されていない場合は乱数で生成
    // Generate random key if not specified
    const key = message.key || Math.random().toString(36).slice(2, 11);

    if (!queue.value.find((q) => q.key === key)) {
      // queue.value.push({ key, text: message.text });
      queue.value.push({ key, text });
    }

    return key;
  }

  /**
   * 指定された key のメッセージをキューから削除します。
   * Remove a message from the queue by key.
   * @param {string} key - 削除するメッセージのキー / Key of the message to remove
   */
  function remove(key) {
    const index = queue.value.findIndex((q) => q.key === key);
    if (index !== -1) {
      queue.value.splice(index, 1);
    }
  }

  /**
   * 全てのメッセージをキューから削除します。
   * Clear all messages from the queue.
   */
  function clear() {
    queue.value.splice(0);
  }

  /**
   * 指定された key のメッセージが存在するか確認します。
   * Check if a message with the specified key exists in the queue.
   * @param {string} key - 検索するメッセージのキー / Key to check
   * @returns {boolean} - 存在する場合は true / true if found
   */
  function has(key) {
    return queue.value.some((q) => q.key === key);
  }

  /**
   * 指定された key のメッセージを置き換えます。
   * Replace the text of a message by key.
   * @param {string} key - 置き換えるメッセージのキー / Key of the message to replace
   * @param {{ text: string }} payload - 新しいテキスト情報 / New text content
   */
  function replace(key, { text }) {
    const target = queue.value.find((q) => q.key === key);
    if (target) {
      target.text = text;
    }
  }

  return {
    queue,
    add,
    remove,
    clear,
    has,
    replace,
  };
});
