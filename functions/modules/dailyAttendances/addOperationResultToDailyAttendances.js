import { changeDailyResults } from "../employees/dailyReferencePlan.js";
export function addOperationResultToDailyAttendances({ attendances = [], operationResult } = {}) {
  return changeDailyResults(attendances, operationResult, true);
}