/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/listLifecycleOperations.js
 * @description 会社管理者へlifecycle operationの最小履歴projectionを返します。
 *****************************************************************************/
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import {
  assertLifecycleOperationHistoryActor,
  resolveLifecycleOperationHistoryInput,
} from "../policies/userLifecyclePolicy.js";
import {
  assertLifecycleOperationRecord,
  LIFECYCLE_CLEANUP_STATES,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
  lifecycleOperationPath,
} from "./lifecycleOperationSchema.js";

const PAGE_SIZE = 20;
const QUERY_LIMIT = PAGE_SIZE + 1;
const OPERATION_TIMESTAMP_FIELDS = Object.freeze([
  "createdAt",
  "updatedAt",
  "authDeletedAt",
  "dataFinalizedAt",
  "completedAt",
]);
const NULLABLE_OPERATION_TIMESTAMP_FIELDS = new Set([
  "authDeletedAt",
  "dataFinalizedAt",
  "completedAt",
]);

function fail(message, domainCode = LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL) {
  const error = new Error(message);
  error.name = "LifecycleOperationHistoryError";
  error.domainCode = domainCode;
  throw error;
}

function assertDependencies(firestore) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function"
  ) {
    fail("[listLifecycleOperations] Firestore dependency is invalid");
  }
}

function assertIdentity(identity) {
  const hasSafeId = (value) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/") &&
    !/\s/u.test(value);
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    !hasSafeId(identity.uid) ||
    !hasSafeId(identity.companyId) ||
    typeof identity.isSuperUser !== "boolean"
  ) {
    fail(
      "[listLifecycleOperations] verified identity is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  if (identity.isSuperUser) {
    fail(
      "[listLifecycleOperations] super-user access is not allowed",
      LIFECYCLE_DOMAIN_ERROR_CODES.ACTOR_NOT_ALLOWED,
    );
  }
}

function timestampToIso(value) {
  if (!(value instanceof Timestamp)) {
    fail("[listLifecycleOperations] operation timestamp is invalid");
  }
  const date = value.toDate();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    fail("[listLifecycleOperations] operation timestamp is invalid");
  }
  return date.toISOString();
}

function assertOperationTimestamps(record) {
  for (const field of OPERATION_TIMESTAMP_FIELDS) {
    const value = record[field];
    if (value === null && NULLABLE_OPERATION_TIMESTAMP_FIELDS.has(field)) {
      continue;
    }
    if (!(value instanceof Timestamp)) {
      fail(`[listLifecycleOperations] ${field} is not a Firestore Timestamp`);
    }
  }
}

function resolvePublicStatus(record) {
  if (record.state === LIFECYCLE_OPERATION_STATES.COMPLETED) {
    return "completed";
  }
  if (
    record.state === LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE ||
    (record.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED &&
      record.cleanupState === LIFECYCLE_CLEANUP_STATES.FAILED)
  ) {
    return "retrying";
  }
  if (
    [
      LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
      LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED,
      LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT,
    ].includes(record.state) ||
    (record.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED &&
      record.cleanupState === LIFECYCLE_CLEANUP_STATES.PENDING)
  ) {
    return "processing";
  }
  fail("[listLifecycleOperations] operation state cannot be projected");
}

function projectOperation(snapshot) {
  if (
    !snapshot ||
    typeof snapshot.id !== "string" ||
    typeof snapshot.data !== "function"
  ) {
    fail("[listLifecycleOperations] operation snapshot is invalid");
  }

  const record = assertLifecycleOperationRecord(snapshot.data());
  if (snapshot.id !== record.operationId) {
    fail("[listLifecycleOperations] operation document ID is invalid");
  }
  assertOperationTimestamps(record);

  const completedAt =
    record.completedAt === null ? null : timestampToIso(record.completedAt);
  const status = resolvePublicStatus(record);
  if ((status === "completed") !== (completedAt !== null)) {
    fail("[listLifecycleOperations] completion timestamp is inconsistent");
  }

  return Object.freeze({
    operationType: record.operationType,
    status,
    actorDisplayName: record.actorDisplayName,
    employeeId:
      record.operationType ===
        LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
        ? null
        : record.employeeId,
    subjectDisplayName:
      record.operationType ===
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
        ? record.targetDisplayName
        : null,
    includesUserAccountDeletion:
      record.operationType !==
        LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT &&
      record.targetUserUid !== null,
    effectiveDate:
      record.operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? record.terminationDate
        : null,
    reason:
      record.operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? record.reasonOfTermination
        : record.operationType ===
            LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
          ? record.offboardingReason
          : null,
    createdAt: timestampToIso(record.createdAt),
    completedAt,
  });
}

function assertCursorSnapshot(snapshot, cursor) {
  if (!snapshot?.exists || snapshot.id !== cursor) {
    fail(
      "[listLifecycleOperations] cursor is unavailable",
      LIFECYCLE_DOMAIN_ERROR_CODES.INVALID_INPUT,
    );
  }
  try {
    projectOperation(snapshot);
  } catch {
    fail(
      "[listLifecycleOperations] cursor is unavailable",
      LIFECYCLE_DOMAIN_ERROR_CODES.INVALID_INPUT,
    );
  }
}

async function assertCurrentHistoryActor({ firestore, companyId, uid }) {
  const actorSnapshot = await firestore
    .doc(`Companies/${companyId}/Users/${uid}`)
    .get();
  if (!actorSnapshot.exists || actorSnapshot.id !== uid) {
    fail(
      "[listLifecycleOperations] actor User was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  assertLifecycleOperationHistoryActor({
    companyId,
    actorUser: actorSnapshot.data(),
  });
}

/**
 * 同社のLifecycleOperationsを作成時刻降順で20件ずつ返します。
 */
export async function listLifecycleOperations({
  firestore,
  identity,
  input,
} = {}) {
  assertDependencies(firestore);
  assertIdentity(identity);
  const { cursor } = resolveLifecycleOperationHistoryInput(input);
  const { companyId, uid } = identity;

  await assertCurrentHistoryActor({ firestore, companyId, uid });

  let query = firestore
    .collection(`Companies/${companyId}/LifecycleOperations`)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (cursor !== null) {
    const anchorSnapshot = await firestore
      .doc(lifecycleOperationPath(companyId, cursor))
      .get();
    assertCursorSnapshot(anchorSnapshot, cursor);
    query = query.startAfter(anchorSnapshot);
  }

  const pageSnapshot = await query.limit(QUERY_LIMIT).get();
  if (!pageSnapshot || !Array.isArray(pageSnapshot.docs)) {
    fail("[listLifecycleOperations] query result is invalid");
  }

  const projected = pageSnapshot.docs.map(projectOperation);
  const hasNextPage = projected.length === QUERY_LIMIT;
  const items = Object.freeze(projected.slice(0, PAGE_SIZE));
  const nextCursor = hasNextPage
    ? pageSnapshot.docs[PAGE_SIZE - 1].id
    : null;

  const response = Object.freeze({
    schemaVersion: 1,
    items,
    nextCursor,
  });
  await assertCurrentHistoryActor({ firestore, companyId, uid });
  return response;
}
