import { RoundSetting } from "@/schemas";

/**
 * 稼働実績を税率ごとに集計し、統合請求書の消費税額内訳を返します。
 * @param {Array<Object>} operationResults
 * @returns {Array<{
 *   taxRate: number,
 *   taxableAmount: number,
 *   unroundedTaxAmount: number,
 *   taxAmount: number
 * }>}
 */
export function calculateTaxBreakdown(operationResults = []) {
  const taxableAmountsByRate = new Map();

  operationResults.forEach((operationResult) => {
    const taxRate = operationResult.taxRate;
    const taxableAmount = operationResult.salesAmount || 0;

    if (typeof taxRate !== "number" || Number.isNaN(taxRate)) {
      throw new Error(
        `Invalid tax rate for OperationResult: ${operationResult.docId || "unknown"}`,
      );
    }

    taxableAmountsByRate.set(
      taxRate,
      (taxableAmountsByRate.get(taxRate) || 0) + taxableAmount,
    );
  });

  return [...taxableAmountsByRate.entries()]
    .sort(([rateA], [rateB]) => rateA - rateB)
    .map(([taxRate, taxableAmount]) => {
      const unroundedTaxAmount = taxableAmount * taxRate;
      return {
        taxRate,
        taxableAmount,
        unroundedTaxAmount,
        taxAmount: RoundSetting.apply(unroundedTaxAmount),
      };
    });
}

