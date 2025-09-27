import { logger } from "firebase-functions";
/**
 * コンテキスト情報付きエラークラス
 * 標準のErrorクラスを拡張し、エラー発生時の詳細情報を保持する
 */
export class ContextualError extends Error {
  /**
   * @param {string} message - エラーメッセージ
   * @param {Object} context - エラー発生時のコンテキスト情報
   * @param {string} context.method - メソッド名
   * @param {Object} context.arguments - 引数情報
   * @param {string} context.timestamp - タイムスタンプ
   */
  constructor(message, context = {}) {
    super(message);
    this.name = "ContextualError";
    this.context = {
      timestamp: new Date().toISOString(),
      ...context,
    };

    logger.error(this.message, this.context);
  }

  /**
   * エラー情報を構造化された形式で取得
   */
  getFormattedContext() {
    return {
      error: this.message,
      name: this.name,
      ...this.context,
    };
  }

  /**
   * デバッグ用の詳細な文字列表現
   */
  toDetailedString() {
    return `${this.name}: ${this.message}\nContext: ${JSON.stringify(
      this.context,
      null,
      2
    )}`;
  }
}
