/**
 * @file composables/useLogger.js
 * @description A composable for logging messages in the application.
 */
export function useLogger(sender, errorsStore) {
  // const errors = useErrorsStore();
  const errors = errorsStore;

  /**
   * Send a log message to the console.
   * @param {Object} params - The log details.
   * @param {("log" | "info" | "warn" | "error")} params.type - The type of console output.
   * @param {string} params.message - The message to be logged.
   * @param {Error | any} [param0.error] - An optional error object, recorded if `type` is `"error"`.
   * @param {any} [params.data] - Additional data to log.
   */
  function send({ type = "log", message = "", error, data }) {
    const validTypes = ["log", "info", "warn", "error"];
    const logType = validTypes.includes(type) ? type : "log";
    const prefix = sender ? `[${sender}] ` : "";
    const text = message ? message : error ? error.message : "No message";
    const output = `${prefix}${text}`;

    console[logType](output, ...(data ? [data] : []));

    // if (logType === "error" && error) {
    //   errors.add(error);
    // }
    if (logType === "error" && error) {
      if (typeof errorsStore?.add === "function") {
        errorsStore.add(error);
      }
    }
  }

  /**
   * Clear all errors from the error management store.
   */
  function clearError() {
    // errors.clear();
    if (typeof errorsStore?.clear === "function") {
      errorsStore.clear();
    }
  }

  return {
    log: ({ message, data }) => send({ type: "log", message, data }),
    info: ({ message, data }) => send({ type: "info", message, data }),
    warn: ({ message, data }) => send({ type: "warn", message, data }),
    error: ({ message, error, data }) =>
      send({ type: "error", message, error, data }),
    clearError,
  };
}
