import { logger } from "firebase-functions";
import {
  DailyAttendance,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * attendance 配列内の DailyAttendance インスタンスに対して、OperationResult ドキュメントを追加します。
 * - DailyAttendance インスタンスが保有する `employeeId` と `date` が、OperationResult.employees 内の
 *   従業員IDと勤怠日と一致する場合にのみ、当該 OperationResult インスタンスが operationResults 配列に追加されます。
 * @param {Object} options
 * @param {Array<{ instance: DailyAttendance, exists: boolean }>} options.attendances
 * @param {OperationResult} options.operationResult
 * @returns {void}
 * @throws {Error} attendances が配列でない場合
 * @throws {Error} attendances 配列内の各要素が { instance: DailyAttendance, exists: boolean } でない場合
 * @throws {Error} operationResult が OperationResult インスタンスでない場合にエラーをスローします。
 *****************************************************************************/
export function addOperationResultToDailyAttendances({
  attendances = [],
  operationResult,
} = {}) {
  logger.info("'addOperationResultToDailyAttendances' is called", {
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

  // OperationResult.employees を取得
  const employees = operationResult.employees ?? [];

  // DailyAttendance インスタンスの `employeeId` と `date` を受け取り、
  // OperationResult.employees 内に該当する従業員IDと勤怠日が存在するかを判定する関数
  const hasEmployeeAttendance = ({ employeeId, date }) => {
    return employees.some((employee) => {
      return employee.id === employeeId && employee.attendanceDate === date;
    });
  };

  // attendance 配列内の DailyAttendance インスタンスについて、OperationResult.employees 内に
  // 該当する従業員IDと勤怠日が存在する場合は、当該 OperationResult インスタンスを operationResults 配列に追加する。
  for (const { instance } of attendances) {
    if (hasEmployeeAttendance(instance)) {
      instance.operationResults = (instance.operationResults ?? []).filter(
        (result) => result.docId !== operationResult.docId,
      );
      instance.operationResults.push(operationResult);
    }
  }
}
