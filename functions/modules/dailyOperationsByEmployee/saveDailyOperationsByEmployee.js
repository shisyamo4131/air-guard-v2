import { logger } from "firebase-functions";
import { DailyOperationByEmployee } from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * DailyOperationByEmployeeを作成・更新し、稼働実績が0件になった
 * 既存ドキュメントを削除します。
 *
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Array<{instance: DailyOperationByEmployee, exists: boolean}>}
 *   options.dailyOperations
 * @param {Transaction} options.transaction
 * @returns {Promise<void>}
 *****************************************************************************/
export async function saveDailyOperationsByEmployee({
  companyId,
  dailyOperations = [],
  transaction,
} = {}) {
  logger.info("'saveDailyOperationsByEmployee' is called", {
    companyId,
    dailyOperations: dailyOperations.length,
  });

  if (!companyId) throw new Error("companyId is required");
  if (!transaction) throw new Error("transaction is required");
  if (!Array.isArray(dailyOperations)) {
    throw new Error("dailyOperations must be an array");
  }
  if (
    !dailyOperations.every(
      ({ instance, exists }) =>
        instance instanceof DailyOperationByEmployee &&
        typeof exists === "boolean",
    )
  ) {
    throw new Error(
      "Each dailyOperation must contain a DailyOperationByEmployee instance and exists flag",
    );
  }

  const prefix = `Companies/${companyId}/`;
  for (const { instance, exists } of dailyOperations) {
    const hasOperationResults = (instance.operationResults ?? []).length > 0;

    if (exists) {
      hasOperationResults
        ? await instance.update({ prefix, transaction })
        : await instance.delete({ prefix, transaction });
      continue;
    }

    if (hasOperationResults) {
      await instance.create({ prefix, transaction });
    }
  }
}
