import { FieldValue } from "firebase-admin/firestore";
import { archiveIdentifier, archiveActorAllowed, archiveFail, parseEmployeeArchiveInput, validateEmployeeArchiveRaw, validateEmployeeArchiveEnvelope } from "../../shared/employeeArchiveContract.js";

export const EMPLOYEE_ARCHIVE_QUERIES = Object.freeze([
  ["SiteOperationSchedules", "employeeIds", "array-contains"], ["OperationResults", "employeeIds", "array-contains"],
  ["ArrangementNotifications", "employeeId", "=="], ["SiteEmployeeHistories", "employeeId", "=="], ["Users", "employeeId", "=="],
  ["LifecycleOperations", "employeeId", "=="], ["Billings", "employeeIds", "array-contains"],
  ["DailyAttendances", "employeeIds", "array-contains"], ["DailyOperationsByEmployee", "employeeIds", "array-contains"],
]);
export const EMPLOYEE_ARCHIVE_DOCUMENTS = Object.freeze(["EmployeeUserReservations", "EmployeeLifecycleLocks", "EmployeeLifecycleHeads"]);
export function parseArchiveTenants(setting) {
  if (setting === undefined) return [];
  let parsed; try { parsed = JSON.parse(setting); } catch { archiveFail("permission-denied", "この会社ではアーカイブを利用できません。"); }
  if (!Array.isArray(parsed) || parsed.some((id) => !archiveIdentifier(id)) || new Set(parsed).size !== parsed.length) archiveFail("permission-denied", "この会社ではアーカイブを利用できません。");
  return parsed;
}
export const configuredArchiveTenants = () => parseArchiveTenants(process.env.AIR_GUARD_EMPLOYEE_ARCHIVE_TENANTS);
export async function archiveEmployee({ firestore, resolveIdentity, input, resolveAllowedTenants = configuredArchiveTenants, timestamp = () => FieldValue.serverTimestamp() }) {
  const parsed = parseEmployeeArchiveInput(input), initial = await resolveIdentity();
  if (!archiveIdentifier(initial.uid) || !archiveIdentifier(initial.companyId)) archiveFail("permission-denied");
  const prefix = `Companies/${initial.companyId}`, activeRef = firestore.doc(`${prefix}/Employees/${parsed.employeeId}`), archiveRef = firestore.doc(`${prefix}/Employees_archive/${parsed.employeeId}`);
  await firestore.runTransaction(async (transaction) => {
    const identity = await resolveIdentity(), tenants = resolveAllowedTenants();
    if (identity.uid !== initial.uid || identity.companyId !== initial.companyId || !Array.isArray(tenants) || tenants.some((id) => !archiveIdentifier(id)) || !tenants.includes(identity.companyId)) archiveFail("permission-denied", "この会社ではアーカイブを利用できません。");
    const [actor, system, active, archived, ...dependencies] = await Promise.all([
      transaction.get(firestore.doc(`${prefix}/Users/${identity.uid}`)), transaction.get(firestore.doc("System/system")),
      transaction.get(activeRef), transaction.get(archiveRef),
      ...EMPLOYEE_ARCHIVE_QUERIES.map(([name, field, operator]) => transaction.get(firestore.collection(`${prefix}/${name}`).where(field, operator, parsed.employeeId).limit(1))),
      ...EMPLOYEE_ARCHIVE_DOCUMENTS.map((name) => transaction.get(firestore.doc(`${prefix}/${name}/${parsed.employeeId}`))),
    ]);
    for (const snapshot of [actor, system, active, archived, ...dependencies.slice(9)]) if (typeof snapshot?.exists !== "boolean" || (snapshot.exists && typeof snapshot.data !== "function")) archiveFail();
    if (!actor.exists || !archiveActorAllowed(identity, actor.data())) archiveFail("permission-denied", "アーカイブ権限がありません。");
    if (!system.exists || system.data()?.isMaintenance !== false) archiveFail("failed-precondition", "メンテナンス状態を確認してください。");
    for (const snapshot of dependencies.slice(0, 9)) if (!Number.isInteger(snapshot?.size) || snapshot.size < 0 || snapshot.size > 1) archiveFail();
    if (dependencies.slice(0, 9).some((snapshot) => snapshot.size > 0) || dependencies.slice(9).some((snapshot) => snapshot.exists)) archiveFail("failed-precondition", "参照されている従業員はアーカイブできません。");
    if (active.exists && archived.exists) archiveFail("already-exists", "原本とアーカイブが両方存在します。");
    if (archived.exists) {
      const envelope = validateEmployeeArchiveEnvelope(archived.data(), parsed.employeeId);
      if (envelope.audit.actorUid !== identity.uid || envelope.audit.operationId !== parsed.operationId || envelope.audit.reason !== parsed.reason) archiveFail("already-exists", "同じIDの別のアーカイブが存在します。");
      return;
    }
    if (!active.exists) archiveFail("not-found", "従業員情報が見つかりません。");
    const employee = validateEmployeeArchiveRaw(active.data(), parsed.employeeId);
    transaction.create(archiveRef, { schemaVersion: 1, employee, audit: { actorUid: identity.uid, operationId: parsed.operationId, reason: parsed.reason, archivedAt: timestamp() } });
    transaction.delete(activeRef);
  });
  return { success: true, archived: true };
}
