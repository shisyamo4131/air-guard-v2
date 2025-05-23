/**
 * アプリケーションからログを出力するためのコンポーザブル。
 * - `log`, `info`, `warn`, `error` メソッドを使用することで各種対応するログをコンソールに出力します。
 * - `error` の場合、`errorsStore` にエラーオブジェクトを格納します。
 * - `clearError` メソッドによって `errorsStore` のエラーを初期化することが可能です。
 */
export function useLogger() {
  const errors = useErrorsStore();

  /**
   * メッセージをコンソールに出力し、`type` が `"error"` の場合は `errors` にエラーを追加します。
   *
   * @param {Object} params - The log details.
   * @param {("log" | "info" | "warn" | "error")} params.type - The type of console output.
   *                                                           出力するログの種類（"log" | "info" | "warn" | "error"）。
   * @param {?string} params.sender - Optional sender identifier.
   *                                   省略可能な送信者の識別名。
   * @param {string} params.message - The message to be logged.
   *                                  出力するメッセージ。
   * @param {Error | any} [param0.error] - An optional error object, recorded if `type` is `"error"`.
   *                                       省略可能なエラーオブジェクト。`type` が `"error"` の場合に記録されます。
   */
  function send({ type, sender, message, error }) {
    const validTypes = ["log", "info", "warn", "error"];
    if (!validTypes.includes(type)) {
      console.warn(`Invalid log type: ${type}. Defaulting to "log".`);
      type = "log";
    }

    console[type](`${sender ? "[" + sender + "]" : ""} ${message}`);

    if (type === "error" && error) {
      errors.add(error);
    }
  }

  /**
   * エラー管理ストアのエラーを初期化します。
   */
  function clearError() {
    errors.clear();
  }

  return {
    log: ({ sender, message }) => send({ type: "log", sender, message }),
    info: ({ sender, message }) => send({ type: "info", sender, message }),
    warn: ({ sender, message }) => send({ type: "warn", sender, message }),
    error: ({ sender, message, error }) =>
      send({ type: "error", sender, message, error }),
    clearError,
  };
}
