import { logger } from "firebase-functions";
import {
  DailyOperationByEmployee,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * DailyOperationByEmployeeから、指定されたOperationResultを取り除きます。
 *
 * @param {Object} options
 * @param {Array<{instance: DailyOperationByEmployee, exists: boolean}>}
 *   options.dailyOperations
 * @param {OperationResult} options.operationResult
 * @returns {void}
 *****************************************************************************/
export function removeOperationResultFromDailyOperationsByEmployee({
  dailyOperations = [],
  operationResult,
} = {}) {
  logger.info(
    "'removeOperationResultFromDailyOperationsByEmployee' is called",
    {
      dailyOperations: dailyOperations.length,
      operationResultId: operationResult?.docId ?? "not provided",
    },
  );

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

  for (const { instance } of dailyOperations) {
    instance.operationResults = (instance.operationResults ?? []).filter(
      (result) => result.docId !== operationResult.docId,
    );
  }
}
