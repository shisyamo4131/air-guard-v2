import { archiveIdentifier, archiveActorAllowed, archiveFail, parseEmployeeArchiveInput, validateEmployeeArchiveRaw } from "../../shared/employeeArchiveContract.js";
import {
  assertEmployeeLifecycleHeadRecord,
  assertLifecycleOperationRecord,
  LIFECYCLE_OPERATION_TYPES,
} from "../auth/lifecycle/lifecycleOperationSchema.js";

export const EMPLOYEE_ARCHIVE_QUERIES = Object.freeze([
  ["Users", "employeeId", "=="],
]);
export const EMPLOYEE_ARCHIVE_DOCUMENTS = Object.freeze(["EmployeeUserReservations", "EmployeeLifecycleLocks", "EmployeeLifecycleHeads"]);
export async function archiveEmployee({ firestore, resolveIdentity, input }) {
  const parsed = parseEmployeeArchiveInput(input), initial = await resolveIdentity();
  if (!archiveIdentifier(initial.uid) || !archiveIdentifier(initial.companyId)) archiveFail("permission-denied");
  const prefix = `Companies/${initial.companyId}`, activeRef = firestore.doc(`${prefix}/Employees/${parsed.employeeId}`), archiveRef = firestore.doc(`${prefix}/Employees_archive/${parsed.employeeId}`);
  await firestore.runTransaction(async (transaction) => {
    const identity = await resolveIdentity();
    if (identity.uid !== initial.uid || identity.companyId !== initial.companyId) archiveFail("permission-denied");
    const [actor, system, active, archived, lifecycleOperations, ...dependencies] = await Promise.all([
      transaction.get(firestore.doc(`${prefix}/Users/${identity.uid}`)), transaction.get(firestore.doc("System/system")),
      transaction.get(activeRef), transaction.get(archiveRef),
      transaction.get(firestore.collection(`${prefix}/LifecycleOperations`).where("employeeId", "==", parsed.employeeId)),
      ...EMPLOYEE_ARCHIVE_QUERIES.map(([name, field, operator]) => transaction.get(firestore.collection(`${prefix}/${name}`).where(field, operator, parsed.employeeId).limit(1))),
      ...EMPLOYEE_ARCHIVE_DOCUMENTS.map((name) => transaction.get(firestore.doc(`${prefix}/${name}/${parsed.employeeId}`))),
    ]);
    const queryCount = EMPLOYEE_ARCHIVE_QUERIES.length;
    const dependencyQueries = dependencies.slice(0, queryCount);
    const dependencyDocuments = dependencies.slice(queryCount);
    for (const snapshot of [actor, system, active, archived, ...dependencyDocuments]) if (typeof snapshot?.exists !== "boolean" || (snapshot.exists && typeof snapshot.data !== "function")) archiveFail();
    if (!Number.isInteger(lifecycleOperations?.size) || lifecycleOperations.size < 0) archiveFail();
    if (!actor.exists || !archiveActorAllowed(identity, actor.data())) archiveFail("permission-denied", "アーカイブ権限がありません。");
    if (!system.exists || system.data()?.isMaintenance !== false) archiveFail("failed-precondition", "メンテナンス状態を確認してください。");
    if (!active.exists) archiveFail("not-found", "従業員情報が見つかりません。");
    const employee = validateEmployeeArchiveRaw(active.data(), parsed.employeeId);
    if (employee.employmentStatus !== "ACTIVE") archiveFail("failed-precondition", "在職中の従業員だけをアーカイブできます。");
    for (const snapshot of dependencyQueries) if (!Number.isInteger(snapshot?.size) || snapshot.size < 0 || snapshot.size > 1) archiveFail();
    if (dependencyQueries.some((snapshot) => snapshot.size > 0) || dependencyDocuments.slice(0, 2).some((snapshot) => snapshot.exists)) archiveFail("failed-precondition", "利用中の従業員はアーカイブできません。");
    const headSnapshot = dependencyDocuments[2];
    let latestOperation = null;
    try {
      if (lifecycleOperations.size > 0) {
        for (const snapshot of lifecycleOperations.docs) {
          const operation = assertLifecycleOperationRecord(snapshot.data());
          if (operation.employeeId !== parsed.employeeId) archiveFail();
          if (operation.state !== "completed" || !["completed", "not-applicable"].includes(operation.cleanupState)) archiveFail("failed-precondition", "従業員の退職・訂正処理が完了していません。");
        }
      }
      if (headSnapshot.exists) {
        const head = assertEmployeeLifecycleHeadRecord(headSnapshot.data());
        latestOperation = lifecycleOperations.docs
          .map((snapshot) => snapshot.data())
          .find((operation) => operation.operationId === head.latestOperationId);
        if (!latestOperation || latestOperation.operationType !== head.latestOperationType || latestOperation.employeeId !== parsed.employeeId) archiveFail("failed-precondition", "従業員のライフサイクル履歴が整合していません。");
      } else if (lifecycleOperations.size > 0) {
        archiveFail("failed-precondition", "従業員のライフサイクル履歴が整合していません。");
      }
    } catch (error) {
      if (error?.name === "EmployeeOperationError") throw error;
      archiveFail("failed-precondition", "従業員のライフサイクル履歴が整合していません。");
    }
    if (latestOperation?.operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT) archiveFail("failed-precondition", "退職済みの従業員はアーカイブできません。");
    if (archived.exists) archiveFail("already-exists", "同じIDのアーカイブが既に存在します。");
  });
  return { success: true, allowed: true, employeeId: parsed.employeeId };
}
