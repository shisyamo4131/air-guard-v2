import { OperationResult } from "@shisyamo4131/air-guard-v2-schemas";

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
