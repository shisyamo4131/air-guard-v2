import { logger } from "firebase-functions";
import {
  DailyOperationByEmployee,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * 変更後のOperationResultを、従業員IDとOperationResultDetail.dateが一致する
 * DailyOperationByEmployeeへ追加します。
 *
 * @param {Object} options
 * @param {Array<{instance: DailyOperationByEmployee, exists: boolean}>}
 *   options.dailyOperations
 * @param {OperationResult} options.operationResult
 * @returns {void}
 *****************************************************************************/
export function addOperationResultToDailyOperationsByEmployee({
  dailyOperations = [],
  operationResult,
} = {}) {
  logger.info("'addOperationResultToDailyOperationsByEmployee' is called", {
    dailyOperations: dailyOperations.length,
    operationResultId: operationResult?.docId ?? "not provided",
  });

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
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }

  const employees = operationResult.employees ?? [];
  for (const { instance } of dailyOperations) {
    const hasTargetEmployee = employees.some(
      (employee) =>
        employee.id === instance.employeeId && employee.date === instance.date,
    );
    if (!hasTargetEmployee) continue;

    instance.operationResults = (instance.operationResults ?? []).filter(
      (result) => result.docId !== operationResult.docId,
    );
    instance.operationResults.push(operationResult);
  }
}
