import { changeDailyResults } from "../employees/dailyReferencePlan.js";
export function removeOperationResultFromDailyAttendances({ attendances = [], operationResult } = {}) {
  return changeDailyResults(attendances, operationResult, true, true);
}