import { syncDailyReferences } from "../employees/dailyReferencePlan.js";
export function syncOperationResultToDailyAttendances(options = {}) {
  return syncDailyReferences({ ...options, attendance: true });
}