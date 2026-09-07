import { fetchDailyTargets } from "../employees/dailyReferencePlan.js";
export function fetchDailyAttendancesRelatedOperationResult(options = {}) {
  return fetchDailyTargets({ ...options, attendance: true, related: false });
}