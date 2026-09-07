import { fetchDailyTargets } from "../employees/dailyReferencePlan.js";
export function fetchDailyOperationsByEmployeeTargets({ dailyOperationsMap, ...options } = {}) {
  return fetchDailyTargets({ ...options, targets: dailyOperationsMap, attendance: false });
}