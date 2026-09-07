import { syncDailyReferences } from "../employees/dailyReferencePlan.js";
export function syncOperationResultToDailyOperationsByEmployee(options = {}) {
  return syncDailyReferences({ ...options, attendance: false });
}