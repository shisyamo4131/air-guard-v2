import { logger } from "firebase-functions";
import {
  DailyOperationByEmployee,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * 変更後のOperationResult.employeesをもとに、配置先となる
 * DailyOperationByEmployeeドキュメントを取得します。
 *
 * @param {Object} options
 * @param {string} options.companyId
 * @param {OperationResult} options.operationResult
 * @param {Transaction} options.transaction
 * @param {Map<string, Object>} options.dailyOperationsMap
 * @returns {Promise<void>}
 *****************************************************************************/
export async function fetchDailyOperationsByEmployeeTargets({
  companyId,
  operationResult,
  transaction,
  dailyOperationsMap,
} = {}) {
  logger.info("'fetchDailyOperationsByEmployeeTargets' is called", {
    companyId,
    operationResultId: operationResult?.docId ?? "not provided",
  });

  if (!companyId) throw new Error("companyId is required");
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }
  if (!transaction) throw new Error("transaction is required");
  if (!(dailyOperationsMap instanceof Map)) {
    throw new Error("dailyOperationsMap must be a Map");
  }

  const prefix = `Companies/${companyId}/`;
  for (const employee of operationResult.employees ?? []) {
    const docId = `${employee.id}_${employee.date}`;
    if (dailyOperationsMap.has(docId)) continue;

    const instance = new DailyOperationByEmployee();
    const exists = await instance.fetch({
      docId,
      prefix,
      transaction,
    });
    if (!exists) {
      instance.initialize({
        docId,
        employeeId: employee.id,
        dateAt: employee.dateAt,
        operationResults: [],
      });
    }
    dailyOperationsMap.set(docId, { instance, exists });
  }
}
