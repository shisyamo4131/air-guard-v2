/**
 * 統一されたエラーハンドリング機能を提供するコンポーザブル
 * - エラーの分類と統一的な処理
 * - リカバリー戦略の提供
 * - ユーザーフレンドリーなエラーメッセージの生成
 */
import { useLogger } from "./useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/**
 * エラーの種類を定義
 */
export const ErrorTypes = {
  NETWORK: "network",
  VALIDATION: "validation",
  PERMISSION: "permission",
  NOT_FOUND: "not_found",
  TIMEOUT: "timeout",
  UNKNOWN: "unknown",
};

/**
 * エラーの重要度を定義
 */
export const ErrorSeverity = {
  LOW: "low", // ログのみ、ユーザーに通知しない
  MEDIUM: "medium", // 警告レベル、ユーザーに通知
  HIGH: "high", // エラーレベル、ユーザーに通知
  CRITICAL: "critical", // クリティカルエラー、即座にユーザーに通知
};

/**
 * 統一エラーハンドリングコンポーザブル
 */
export function useErrorHandler(context = "Unknown") {
  const logger = useLogger(context, useErrorsStore());

  /**
   * エラーを分類する
   * @param {Error} error - 分類するエラー
   * @returns {string} エラーの種類
   */
  function classifyError(error) {
    if (!error) return ErrorTypes.UNKNOWN;

    const message = error.message?.toLowerCase() || "";
    const code = error.code?.toLowerCase() || "";

    // ネットワークエラー
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      code.includes("network") ||
      (error.name === "TypeError" && message.includes("failed to fetch"))
    ) {
      return ErrorTypes.NETWORK;
    }

    // 権限エラー
    if (
      message.includes("permission") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      code.includes("permission")
    ) {
      return ErrorTypes.PERMISSION;
    }

    // 見つからないエラー
    if (
      message.includes("not found") ||
      message.includes("does not exist") ||
      code.includes("not-found")
    ) {
      return ErrorTypes.NOT_FOUND;
    }

    // タイムアウトエラー
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      code.includes("timeout")
    ) {
      return ErrorTypes.TIMEOUT;
    }

    // バリデーションエラー
    if (
      message.includes("validation") ||
      message.includes("invalid") ||
      message.includes("required") ||
      code.includes("invalid")
    ) {
      return ErrorTypes.VALIDATION;
    }

    return ErrorTypes.UNKNOWN;
  }

  /**
   * エラーの重要度を決定する
   * @param {string} errorType - エラーの種類
   * @param {Error} error - エラーオブジェクト
   * @returns {string} エラーの重要度
   */
  function getErrorSeverity(errorType, error) {
    switch (errorType) {
      case ErrorTypes.VALIDATION:
        return ErrorSeverity.MEDIUM;
      case ErrorTypes.NOT_FOUND:
        return ErrorSeverity.MEDIUM;
      case ErrorTypes.NETWORK:
        return ErrorSeverity.HIGH;
      case ErrorTypes.PERMISSION:
        return ErrorSeverity.HIGH;
      case ErrorTypes.TIMEOUT:
        return ErrorSeverity.HIGH;
      default:
        return ErrorSeverity.CRITICAL;
    }
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを生成する
   * @param {string} errorType - エラーの種類
   * @param {Error} error - エラーオブジェクト
   * @param {string} operationContext - 操作のコンテキスト
   * @returns {string} ユーザーフレンドリーなメッセージ
   */
  function getUserFriendlyMessage(errorType, error, operationContext) {
    const baseContext = operationContext || "操作";

    switch (errorType) {
      case ErrorTypes.NETWORK:
        return `ネットワークエラーが発生しました。インターネット接続を確認し、再試行してください。`;

      case ErrorTypes.PERMISSION:
        return `この${baseContext}を実行する権限がありません。管理者にお問い合わせください。`;

      case ErrorTypes.NOT_FOUND:
        return `要求されたデータが見つかりませんでした。データが削除されている可能性があります。`;

      case ErrorTypes.TIMEOUT:
        return `${baseContext}がタイムアウトしました。しばらく時間をおいて再試行してください。`;

      case ErrorTypes.VALIDATION:
        return `入力データに問題があります。入力内容を確認してください。`;

      default:
        return `予期しないエラーが発生しました。問題が続く場合は管理者にお問い合わせください。`;
    }
  }

  /**
   * リカバリー戦略を提案する
   * @param {string} errorType - エラーの種類
   * @returns {Object} リカバリー戦略
   */
  function getRecoveryStrategy(errorType) {
    switch (errorType) {
      case ErrorTypes.NETWORK:
        return {
          canRetry: true,
          retryDelay: 2000,
          maxRetries: 3,
          suggestion: "ネットワーク接続を確認してから再試行",
        };

      case ErrorTypes.TIMEOUT:
        return {
          canRetry: true,
          retryDelay: 5000,
          maxRetries: 2,
          suggestion: "しばらく待ってから再試行",
        };

      case ErrorTypes.NOT_FOUND:
        return {
          canRetry: false,
          retryDelay: 0,
          maxRetries: 0,
          suggestion: "データを再読み込みするか、ページをリフレッシュ",
        };

      case ErrorTypes.PERMISSION:
        return {
          canRetry: false,
          retryDelay: 0,
          maxRetries: 0,
          suggestion: "管理者に連絡して権限を確認",
        };

      case ErrorTypes.VALIDATION:
        return {
          canRetry: false,
          retryDelay: 0,
          maxRetries: 0,
          suggestion: "入力データを修正してから再試行",
        };

      default:
        return {
          canRetry: true,
          retryDelay: 1000,
          maxRetries: 1,
          suggestion: "しばらく待ってから再試行",
        };
    }
  }

  /**
   * エラーを統一的に処理する
   * @param {Error} error - 処理するエラー
   * @param {Object} options - オプション
   * @param {string} options.operation - 操作名
   * @param {string} options.details - 詳細情報
   * @param {boolean} options.silent - サイレントモード（ユーザーに通知しない）
   * @returns {Object} エラー処理結果
   */
  function handleError(error, options = {}) {
    const { operation = "不明な操作", details = "", silent = false } = options;

    // エラーの分類と重要度の決定
    const errorType = classifyError(error);
    const severity = getErrorSeverity(errorType, error);
    const userMessage = getUserFriendlyMessage(errorType, error, operation);
    const recovery = getRecoveryStrategy(errorType);

    // 内部ログ記録
    const logMessage = `${operation}でエラーが発生: ${error.message}${
      details ? ` - ${details}` : ""
    }`;

    if (severity === ErrorSeverity.LOW) {
      logger.info({
        message: logMessage,
      });
    } else if (severity === ErrorSeverity.MEDIUM) {
      logger.warn({
        message: logMessage,
      });
    } else {
      logger.error({
        message: logMessage,
        error,
      });
    }

    // エラー処理結果を返す
    return {
      errorType,
      severity,
      userMessage,
      recovery,
      originalError: error,
      silent: silent || severity === ErrorSeverity.LOW,
    };
  }

  /**
   * 非同期操作を安全に実行する
   * @param {Function} asyncFunction - 実行する非同期関数
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 実行結果
   */
  async function safeAsyncExecution(asyncFunction, options = {}) {
    const {
      operation = "非同期操作",
      retryOptions = null,
      onError = null,
    } = options;

    let lastError = null;
    let attemptCount = 0;
    const maxAttempts = retryOptions?.maxRetries
      ? retryOptions.maxRetries + 1
      : 1;

    while (attemptCount < maxAttempts) {
      try {
        attemptCount++;
        const result = await asyncFunction();

        // 成功した場合、以前のエラーがあれば回復ログを出力
        if (lastError && attemptCount > 1) {
          logger.info({
            sender: context,
            message: `${operation}が${attemptCount}回目の試行で成功しました`,
          });
        }

        return {
          success: true,
          data: result,
          error: null,
          attempts: attemptCount,
        };
      } catch (error) {
        lastError = error;

        // エラーを処理
        const errorResult = handleError(error, {
          operation,
          details: `試行回数: ${attemptCount}/${maxAttempts}`,
        });

        // リトライ可能かチェック
        if (attemptCount < maxAttempts && errorResult.recovery.canRetry) {
          logger.warn({
            message: `${operation}が失敗。${errorResult.recovery.retryDelay}ms後に再試行します（${attemptCount}/${maxAttempts}）`,
          });

          // リトライ前の待機
          if (errorResult.recovery.retryDelay > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, errorResult.recovery.retryDelay)
            );
          }
          continue;
        }

        // エラーコールバックを実行
        if (onError) {
          await onError(errorResult);
        }

        return {
          success: false,
          data: null,
          error: errorResult,
          attempts: attemptCount,
        };
      }
    }
  }

  return {
    // エラー分類
    classifyError,
    getErrorSeverity,
    getUserFriendlyMessage,
    getRecoveryStrategy,

    // メイン処理
    handleError,
    safeAsyncExecution,

    // 定数
    ErrorTypes,
    ErrorSeverity,
  };
}
