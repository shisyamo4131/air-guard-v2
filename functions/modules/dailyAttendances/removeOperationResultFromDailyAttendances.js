import { logger } from "firebase-functions";
import {
  DailyAttendance,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * attendance 配列内の DailyAttendance インスタンスから、OperationResult ドキュメントを取り除きます。
 * - OperationResult インスタンスの `docId` と一致するものを DailyAttendance.operationResults 配列から削除します。
 * @param {Object} options
 * @param {Array<{ instance: DailyAttendance, exists: boolean }>} options.attendances
 * @param {OperationResult} options.operationResult
 * @returns {void}
 * @throws {Error} operationResult が OperationResult インスタンスでない場合
 *****************************************************************************/
export function removeOperationResultFromDailyAttendances({
  attendances = [],
  operationResult,
} = {}) {
  logger.info("'removeOperationResultFromDailyAttendances' is called", {
    attendances: attendances.length,
    operationResultId: operationResult ? operationResult.docId : "not provided",
  });

  // attendances が配列でない場合はエラー
  if (!Array.isArray(attendances)) {
    throw new Error("attendances must be an array");
  }

  // attendances 配列内の各要素が { instance: DailyAttendance, exists: boolean } でない場合はエラー
  if (
    !attendances.every(
      ({ instance, exists }) =>
        instance instanceof DailyAttendance && typeof exists === "boolean",
    )
  ) {
    throw new Error(
      "Each attendance must be an object with instance as DailyAttendance and exists as boolean",
    );
  }

  // operationResult が OperationResult インスタンスでない場合はエラー
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }

  const operationResultDocId = operationResult.docId;
  for (const { instance } of attendances) {
    instance.operationResults = (instance.operationResults ?? []).filter(
      (result) => result.docId !== operationResultDocId,
    );
  }
}
