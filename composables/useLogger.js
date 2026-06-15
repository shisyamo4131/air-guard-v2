/**
 * @file composables/useLogger.js
 * @description A composable for logging messages in the application.
 * It supports different log levels and can optionally record errors in a provided error store.
 *
 * [更新履歴]
 * 2026-06-15 - "debug" を追加
 *
 * @param {string} [sender] - An optional identifier for the log sender.
 * @param {Object} [errorsStore] - An optional error store with `add` and `clear` methods.
 * @returns {Object} An object with logging methods: `log`, `info`, `warn`, `error`, and `clearError`.
 */
export function useLogger(sender, errorsStore) {
  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * Send a log message to the console.
   * @param {Object} params - The log details.
   * @param {("log" | "info" | "warn" | "error" | "debug")} params.type - The type of console output.
   * @param {string} params.message - The message to be logged.
   * @param {Error | any} [params.error] - An optional error object, recorded if `type` is `"error"`.
   * @param {any} [params.data] - Additional data to log.
   */
  function send(params) {
    const { type = "log", message = "", error, data } = params;
    const validTypes = ["log", "info", "warn", "error", "debug"];
    const logType = validTypes.includes(type) ? type : "log";
    const prefix = sender ? `[${sender}] ` : "";
    const text = message ? message : error ? error.message : "No message";
    const output = `${prefix}${text}`;

    console[logType](output, ...(data ? [data] : []));

    if (logType === "error") {
      if (typeof errorsStore?.add === "function") {
        errorsStore.add(error || new Error(text));
      }
    }
  }

  /**
   * Clear all recorded errors from the error store.
   * If no error store is provided, this function does nothing.
   */
  function clearError() {
    if (typeof errorsStore?.clear === "function") {
      errorsStore.clear();
    }
  }

  /***************************************************************************
   * RETURN
   ***************************************************************************/
  return {
    debug: ({ message, data }) => send({ type: "debug", message, data }),
    log: ({ message, data }) => send({ type: "log", message, data }),
    info: ({ message, data }) => send({ type: "info", message, data }),
    warn: ({ message, data }) => send({ type: "warn", message, data }),
    error: ({ message, error, data }) =>
      send({ type: "error", message, error, data }),
    clearError,
  };
}
