import { changeDailyResults } from "../employees/dailyReferencePlan.js";
export function addOperationResultToDailyOperationsByEmployee({ dailyOperations = [], operationResult } = {}) {
  return changeDailyResults(dailyOperations, operationResult, false);
}