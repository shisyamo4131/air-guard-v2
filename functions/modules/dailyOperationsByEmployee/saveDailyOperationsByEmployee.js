import { saveDailyTargets } from "../employees/dailyReferencePlan.js";
export function saveDailyOperationsByEmployee({ dailyOperations = [], ...options } = {}) {
  return saveDailyTargets({ ...options, entries: dailyOperations, attendance: false });
}