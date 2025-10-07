/**
 * アプリ内で発生したエラー情報を管理するためのストア
 * - ストアに新しいエラーオブジェクトが与えられると、メッセージストアにメッセージキューを追加します。
 */
export const useErrorsStore = defineStore("errors", () => {
  const messages = useMessagesStore();

  /** List of errors. */
  const list = ref([]);

  /** Indicates that an error has occurred in the application. */
  const hasError = computed(() => {
    return list.value.length > 0;
  });

  /**
   * Stores error object to list, avoiding duplicates.
   * 重複したエラーは追加しません。
   * @param {Error} error
   */
  function add(error) {
    const lastError = list.value[list.value.length - 1];
    const message = error.userMessage || error.message || String(error);
    const isDuplicate =
      lastError &&
      lastError.message === message &&
      lastError.stack === error.stack;

    if (!isDuplicate) {
      list.value.push(error);
      messages.add({ text: message, color: "error" });
    }
  }

  /**
   * Clear errors list.
   */
  function clear() {
    list.value.splice(0);
  }

  return {
    add,
    clear,
    hasError,
    list,
  };
});
