/**
 * 分数を「H時間MM分」形式へ変換します。
 * @param {*} value
 * @returns {string}
 */
export function formatAttendanceMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "-";

  const sign = minutes < 0 ? "-" : "";
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const remainingMinutes = Math.floor(absoluteMinutes % 60);

  return `${sign}${hours}時間${String(remainingMinutes).padStart(2, "0")}分`;
}
