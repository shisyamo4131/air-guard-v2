/*****************************************************************************
 * @file utils/csv/exportAttendancePunchesCsv.js
 * @description 打刻データをCSVファイルとしてダウンロードする。
 *****************************************************************************/

/**
 * @param {Object} options
 * @param {Array<Object>} options.rows
 * @param {Date} options.from
 * @param {Date} options.to
 * @returns {void}
 */
export function exportAttendancePunchesCsv({ rows = [], from, to } = {}) {
  const headers = [
    "employeeCode",
    "employeeName",
    "punchTypeCode",
    "punchDateTime",
  ];
  const values = rows.map((row) => [
    row.employeeCode,
    row.employeeName,
    row.punchTypeCode,
    row.punchDateTime,
  ]);
  const csv = [
    headers.join(","),
    ...values.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `attendance_punches_${formatDate(from)}_${formatDate(to)}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\r") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "unknown";

  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
