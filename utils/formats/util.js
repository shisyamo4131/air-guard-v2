/**
 * 数値を桁区切り形式にフォーマットします。
 * 小数点以下もそのまま保持されます。
 * @param {number} value - フォーマットする数値
 * @returns {string} 桁区切りされた文字列 (例: 1000.5 -> "1,000.5")
 */
export function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 20,
  }).format(value);
}

/**
 * 数値を日本円の通貨形式にフォーマットします。
 * @param {number} value - フォーマットする数値
 * @returns {string} 通貨形式の文字列 (例: 1000 -> "¥1,000")
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
  }).format(value);
}
