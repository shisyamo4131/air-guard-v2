/**
 * Store for management errors.
 * エラー管理用ストア
 */
export const useErrorsStore = defineStore("errors", () => {
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
    const isDuplicate =
      lastError &&
      lastError.message === error.message &&
      lastError.stack === error.stack;

    if (!isDuplicate) {
      list.value.push(error);
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
