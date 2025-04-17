/**
 * useMessagesStore
 * アプリ全体で使用するスナックバーメッセージのキューを管理するストア。
 * v-snackbar-queue と組み合わせて、UI 上の通知表示を一元化します。
 *
 * A Pinia store for managing global snackbar messages in a queue.
 * Used in combination with v-snackbar-queue to centralize UI notifications.
 */
export const useMessagesStore = defineStore("messages", () => {
  /**
   * スナックバーに表示するメッセージキュー。
   * 表示順に配列として格納され、先頭から順に表示されます。
   *
   * The queue of messages to be displayed in the snackbar.
   * Messages are shown in order from the beginning of the array.
   */
  const queue = ref([]);

  /**
   * メッセージをキューに追加します。
   * Add a message to the queue.
   * @param {{ text: string, color?: string }} message - 表示メッセージと任意のカラー
   */
  function add(message) {
    queue.value.push(message);
  }

  return { queue, add };
});
