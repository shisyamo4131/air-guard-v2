/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/reconcileLifecycleOperations.js
 * @description 非terminal UWB-07 operationをservice identityで再開します。
 *****************************************************************************/
import {
  assertLifecycleOperationRecord,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
} from "./lifecycleOperationSchema.js";
import { resumeEmployeeRetirementOperation } from "./terminateEmployee.js";
import { resumeStandaloneRegisteredUserDeletionOperation } from "./deleteStandaloneRegisteredUser.js";

const RECONCILABLE_STATES = Object.freeze([
  LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
  LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED,
  LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT,
  LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
  LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE,
]);

function assertDependencies({
  firestore,
  auth,
  cleanupFcm,
  limit,
  onFailure,
  resumeEmployeeRetirement,
  resumeStandaloneDeletion,
}) {
  if (
    !firestore ||
    typeof firestore.collectionGroup !== "function" ||
    !auth ||
    typeof auth.getUser !== "function" ||
    typeof cleanupFcm !== "function" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    typeof onFailure !== "function" ||
    typeof resumeEmployeeRetirement !== "function" ||
    typeof resumeStandaloneDeletion !== "function"
  ) {
    throw new TypeError("[reconcileLifecycleOperations] dependencies are invalid");
  }
}

function resolveCompanyId(snapshot) {
  const collection = snapshot?.ref?.parent;
  const companyRef = collection?.parent;
  if (
    collection?.id !== "LifecycleOperations" ||
    companyRef?.parent?.id !== "Companies" ||
    typeof companyRef?.id !== "string" ||
    !companyRef.id
  ) {
    throw new TypeError(
      "[reconcileLifecycleOperations] operation path is invalid",
    );
  }
  return companyRef.id;
}

/**
 * 最大100件を逐次処理します。失敗operationはlockとfailure stateを維持し、
 * 後続scheduleで再試行します。結果とfailure callbackに識別子やpayloadを含めません。
 */
export async function reconcileLifecycleOperations({
  firestore,
  auth,
  cleanupFcm,
  limit = 50,
  onFailure = () => {},
  resumeEmployeeRetirement = resumeEmployeeRetirementOperation,
  resumeStandaloneDeletion =
    resumeStandaloneRegisteredUserDeletionOperation,
} = {}) {
  assertDependencies({
    firestore,
    auth,
    cleanupFcm,
    limit,
    onFailure,
    resumeEmployeeRetirement,
    resumeStandaloneDeletion,
  });
  const snapshot = await firestore
    .collectionGroup("LifecycleOperations")
    .where("state", "in", [...RECONCILABLE_STATES])
    .limit(limit)
    .get();
  const summary = { scanned: snapshot.size, completed: 0, pending: 0, failed: 0 };

  for (const documentSnapshot of snapshot.docs) {
    let operationType = "invalid";
    let operationState = "invalid";
    try {
      const companyId = resolveCompanyId(documentSnapshot);
      const operation = assertLifecycleOperationRecord(documentSnapshot.data());
      operationType = operation.operationType;
      operationState = operation.state;
      let result;
      if (
        operation.operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT &&
        operation.targetUserUid !== null
      ) {
        result = await resumeEmployeeRetirement({
          firestore,
          auth,
          cleanupFcm,
          companyId,
          operation,
        });
      } else if (
        operation.operationType ===
        LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
      ) {
        result = await resumeStandaloneDeletion({
          firestore,
          auth,
          cleanupFcm,
          companyId,
          operation,
        });
      } else {
        throw new TypeError(
          "[reconcileLifecycleOperations] operation type is not reconcilable",
        );
      }

      if (result.status === "completed") summary.completed += 1;
      else summary.pending += 1;
    } catch (error) {
      summary.failed += 1;
      onFailure({
        operationType,
        operationState,
        errorName: error?.name,
        errorCode: error?.code,
        domainCode: error?.domainCode,
      });
    }
  }

  return Object.freeze({ ...summary });
}
