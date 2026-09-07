import { fetchDailyTargets } from "../employees/dailyReferencePlan.js";
export function fetchDailyOperationsByEmployeeRelatedOperationResult(options = {}) {
  return fetchDailyTargets({ ...options, attendance: false, related: true });
}