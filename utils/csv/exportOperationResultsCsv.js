/*****************************************************************************
 * @file utils/exportOperationResultsCsv.js
 *****************************************************************************/

/**
 * CSV出力
 * @param {Array<OperationResult>} operationResults
 * @param {Object} cachedSites
 */
export function exportOperationResultsCsv({
  operationResults = [],
  cachedSites = {},
} = {}) {
  const headers = [
    // 識別情報
    "docId",
    "customerId",

    // 現場
    "siteId",
    "siteCode",
    "siteNumber", // 将来用
    "siteName",

    // 取極め
    "agreementDate",

    // 基本情報
    "date",
    "attendanceDate",
    "dayType",
    "shiftType",

    // 時間
    "startTime",
    "endTime",
    "breakMinutes",
    "regulationWorkMinutes",

    // 人数
    "baseQuantity",
    "qualifiedQuantity",

    // 残業
    "baseOvertimeMinutes",
    "qualifiedOvertimeMinutes",

    // 状態
    "isLocked",

    // 調整利用
    "useAdjusted",

    // 調整値
    "adjustedQuantityBase",
    "adjustedOvertimeMinutesBase",
    "adjustedUnitPriceBase",
    "adjustedOvertimeUnitPriceBase",

    "adjustedQuantityQualified",
    "adjustedOvertimeMinutesQualified",
    "adjustedUnitPriceQualified",
    "adjustedOvertimeUnitPriceQualified",

    // 売上(original)
    "originalBaseUnitPrice",
    "originalBaseQuantity",
    "originalBaseOvertimeUnitPrice",
    "originalBaseOvertimeMinutes",
    "originalBaseTotal",

    "originalQualifiedUnitPrice",
    "originalQualifiedQuantity",
    "originalQualifiedOvertimeUnitPrice",
    "originalQualifiedOvertimeMinutes",
    "originalQualifiedTotal",

    // 売上(adjusted)
    "adjustedBaseUnitPrice",
    "adjustedBaseQuantity",
    "adjustedBaseOvertimeUnitPrice",
    "adjustedBaseOvertimeMinutes",
    "adjustedBaseTotal",

    "adjustedQualifiedUnitPrice",
    "adjustedQualifiedQuantity",
    "adjustedQualifiedOvertimeUnitPrice",
    "adjustedQualifiedOvertimeMinutes",
    "adjustedQualifiedTotal",

    // 請求
    "billingDate",
    "billingMonth",
    "salesArticles",
    "salesAmount",
    "tax",
    "billingAmount",
  ];

  const rows = operationResults.map((operationResult) => {
    const site = cachedSites[operationResult.siteId];

    return [
      // 識別情報
      operationResult.docId ?? "",
      operationResult.customerId ?? "",

      // 現場
      operationResult.siteId ?? "",
      site?.code ?? "",
      "", // siteNumber 将来用
      site?.name ?? "",

      // 取極め
      operationResult.agreement?.date ?? "",

      // 基本情報
      operationResult.date ?? "",
      operationResult.attendanceDate ?? "",
      operationResult.dayType ?? "",
      operationResult.shiftType ?? "",

      // 時間
      operationResult.startTime ?? "",
      operationResult.endTime ?? "",
      operationResult.breakMinutes ?? 0,
      operationResult.regulationWorkMinutes ?? 0,

      // 人数
      operationResult.statistics?.base?.quantity ?? 0,
      operationResult.statistics?.qualified?.quantity ?? 0,

      // 残業
      operationResult.statistics?.base?.overtimeWorkMinutes ?? 0,
      operationResult.statistics?.qualified?.overtimeWorkMinutes ?? 0,

      // 状態
      operationResult.isLocked ? 1 : 0,

      // 調整利用
      operationResult.useAdjusted ? 1 : 0,

      // 調整値
      operationResult.adjustedQuantityBase ?? 0,
      operationResult.adjustedOvertimeMinutesBase ?? 0,
      operationResult.adjustedUnitPriceBase ?? 0,
      operationResult.adjustedOvertimeUnitPriceBase ?? 0,

      operationResult.adjustedQuantityQualified ?? 0,
      operationResult.adjustedOvertimeMinutesQualified ?? 0,
      operationResult.adjustedUnitPriceQualified ?? 0,
      operationResult.adjustedOvertimeUnitPriceQualified ?? 0,

      // 売上(original)
      operationResult.sales?.original?.base?.unitPrice ?? 0,
      operationResult.sales?.original?.base?.quantity ?? 0,
      operationResult.sales?.original?.base?.overtimeUnitPrice ?? 0,
      operationResult.sales?.original?.base?.overtimeMinutes ?? 0,
      operationResult.sales?.original?.base?.total ?? 0,

      operationResult.sales?.original?.qualified?.unitPrice ?? 0,
      operationResult.sales?.original?.qualified?.quantity ?? 0,
      operationResult.sales?.original?.qualified?.overtimeUnitPrice ?? 0,
      operationResult.sales?.original?.qualified?.overtimeMinutes ?? 0,
      operationResult.sales?.original?.qualified?.total ?? 0,

      // 売上(adjusted)
      operationResult.sales?.adjusted?.base?.unitPrice ?? 0,
      operationResult.sales?.adjusted?.base?.quantity ?? 0,
      operationResult.sales?.adjusted?.base?.overtimeUnitPrice ?? 0,
      operationResult.sales?.adjusted?.base?.overtimeMinutes ?? 0,
      operationResult.sales?.adjusted?.base?.total ?? 0,

      operationResult.sales?.adjusted?.qualified?.unitPrice ?? 0,
      operationResult.sales?.adjusted?.qualified?.quantity ?? 0,
      operationResult.sales?.adjusted?.qualified?.overtimeUnitPrice ?? 0,
      operationResult.sales?.adjusted?.qualified?.overtimeMinutes ?? 0,
      operationResult.sales?.adjusted?.qualified?.total ?? 0,

      // 請求
      operationResult.billingDate ?? "",
      operationResult.billingMonth ?? "",
      operationResult.salesArticles ?? 0,
      operationResult.salesAmount ?? 0,
      operationResult.tax ?? 0,
      operationResult.billingAmount ?? 0,
    ];
  });

  const escapeCsv = (value) => {
    const str = String(value ?? "");

    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  const bom = "\uFEFF";

  const blob = new Blob([bom + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  const today = new Date().toISOString().slice(0, 10);

  a.download = `operation_results_${today}.csv`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
