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
   * @param {{ key: string, text: string }} message - 表示するメッセージオブジェクト / Message object to be displayed
   */
  function add(message) {
    if (!message?.key || !message?.text) return;
    if (!queue.value.find((q) => q.key === message.key)) {
      queue.value.push(message);
    }
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
