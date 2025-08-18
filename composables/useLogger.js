/**
 * @file composables/useLogger.js
 * @description A composable for logging messages in the application.
 */
export function useLogger(sender) {
  const errors = useErrorsStore();

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
    const output = `${prefix}${message}`;

    console[logType](output, ...(data ? [data] : []));

    if (logType === "error" && error) {
      errors.add(error);
    }
  }

  /**
   * Clear all errors from the error management store.
   */
  function clearError() {
    errors.clear();
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
