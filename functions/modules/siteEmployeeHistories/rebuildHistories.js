import { rebuildHistory } from "./rebuildHistory.js";
import { assertBackgroundId, failReference } from "../employees/backgroundReferencePlan.js";
export async function rebuildHistories(companyId, siteId, employeeIds = [], options = {}) {
  assertBackgroundId(companyId); assertBackgroundId(siteId);
  if (!Array.isArray(employeeIds)) failReference();
  employeeIds.forEach((id) => assertBackgroundId(id));
  for (const employeeId of new Set(employeeIds)) await rebuildHistory(companyId, siteId, employeeId, options);
}