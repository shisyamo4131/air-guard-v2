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
   * Stores error object to list.
   * @param {Error} error - An Error object.
   */
  function add(error) {
    list.value.push(error);
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
