import { saveDailyTargets } from "../employees/dailyReferencePlan.js";
export function saveDailyAttendances({ attendances = [], ...options } = {}) {
  return saveDailyTargets({ ...options, entries: attendances, attendance: true });
}