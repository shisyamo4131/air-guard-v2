import { changeDailyResults } from "../employees/dailyReferencePlan.js";
export function removeOperationResultFromDailyOperationsByEmployee({ dailyOperations = [], operationResult } = {}) {
  return changeDailyResults(dailyOperations, operationResult, false, true);
}