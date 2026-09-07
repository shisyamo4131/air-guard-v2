import { plain } from "../../shared/employeeContract.js";
import { operationEmployeeReferences, notificationEmployeeReferences, aggregateEmployeeReferences } from "../../shared/operationReferences.js";
import { assertBackgroundId, failReference } from "./backgroundReferencePlan.js";

export const EMPLOYEE_REFERENCE_COLLECTIONS = Object.freeze([
  "SiteOperationSchedules", "OperationResults", "ArrangementNotifications",
  "DailyAttendances", "DailyOperationsByEmployee", "Billings",
]);

// Deliberately accepts supplied raw records. It does not connect to Firestore,
// scan other tenants, mutate data, or grant permission to open archive APIs.
export function inspectEmployeeReferences({ companyId, collections } = {}) {
  assertBackgroundId(companyId);
  if (!plain(collections) || Object.keys(collections).some((key) => !EMPLOYEE_REFERENCE_COLLECTIONS.includes(key))) failReference();
  const issues = [], counts = {};
  for (const collection of EMPLOYEE_REFERENCE_COLLECTIONS) {
    const records = collections[collection];
    if (!Array.isArray(records)) { issues.push({ collection, reason: "unverified-collection" }); continue; }
    counts[collection] = records.length;
    const seen = new Set();
    for (const entry of records) {
      try {
        if (!plain(entry)) failReference();
        assertBackgroundId(entry.id, 1500);
        if (seen.has(entry.id) || !plain(entry.raw) || entry.raw.docId !== entry.id) failReference();
        if (entry.raw.companyId !== undefined && entry.raw.companyId !== companyId) failReference();
        seen.add(entry.id);
        if (collection === "SiteOperationSchedules") operationEmployeeReferences(entry.raw, { scheduleId: entry.id });
        else if (collection === "OperationResults") operationEmployeeReferences(entry.raw);
        else if (collection === "ArrangementNotifications") notificationEmployeeReferences(entry.raw);
        else aggregateEmployeeReferences(entry.raw, { daily: collection !== "Billings" });
      } catch { issues.push({ collection, reason: "invalid-reference-data" }); }
    }
  }
  return { companyId, mode: "dry-run", consistent: issues.length === 0, archiveReady: false, counts, issues };
}

// The caller must provide an explicitly selected tenant/raw reader. Read errors
// propagate; a partially completed scan can never produce a successful report.
export async function runEmployeeReferenceDryRun({ companyId, readCollection } = {}) {
  assertBackgroundId(companyId);
  if (typeof readCollection !== "function") failReference();
  const collections = {};
  for (const name of EMPLOYEE_REFERENCE_COLLECTIONS) collections[name] = await readCollection(companyId, name);
  return inspectEmployeeReferences({ companyId, collections });
}
