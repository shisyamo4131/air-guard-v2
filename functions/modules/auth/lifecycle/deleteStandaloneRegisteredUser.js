/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/deleteStandaloneRegisteredUser.js
 * @description UWB-07B 単独本登録User削除use-caseです。
 *****************************************************************************/
import { createUserEmailReservationId } from "../createTemporaryUser.js";
import {
  assertStandaloneRegisteredUserDeletionActor,
  assertStandaloneRegisteredUserDeletionTarget,
  resolveStandaloneRegisteredUserDeletionInput,
} from "../policies/userLifecyclePolicy.js";
import { createRegisteredUserAuthGateway } from "./registeredUserAuthGateway.js";
import {
  assertLifecycleOperationRecord,
  createLifecycleRequestFingerprint,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
  lifecycleOperationPath,
} from "./lifecycleOperationSchema.js";
import { createFirestoreLifecycleOperationStore } from "./lifecycleOperationStore.js";
import { runRegisteredUserDeletion } from "./registeredUserDeletionEngine.js";

export const DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES = Object.freeze({
  DEPENDENCY_INVALID: "dependency-invalid",
  IDENTITY_INVALID: "identity-invalid",
  TARGET_NOT_FOUND: "target-not-found",
  RELATIONSHIP_INCONSISTENT: "relationship-inconsistent",
  TEMPORARY_USER_LINKED: "temporary-user-linked",
  AUTH_IDENTITY_MISMATCH: "auth-identity-mismatch",
  OPERATION_ID_CONFLICT: "operation-id-conflict",
});

export class DeleteStandaloneRegisteredUserError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "DeleteStandaloneRegisteredUserError";
    this.code = code;
    this.domainCode = options.domainCode ?? LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL;
  }
}

function fail(code, message, domainCode, options = {}) {
  throw new DeleteStandaloneRegisteredUserError(code, message, {
    ...options,
    domainCode,
  });
}

function assertDependencies({ firestore, auth, cleanupFcm }) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function" ||
    typeof firestore.runTransaction !== "function" ||
    !auth ||
    typeof auth.getUser !== "function" ||
    typeof auth.updateUser !== "function" ||
    typeof auth.deleteUser !== "function" ||
    typeof cleanupFcm !== "function"
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.DEPENDENCY_INVALID,
      "[deleteStandaloneRegisteredUser] dependencies are invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
    );
  }
}

function assertIdentity(identity) {
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    typeof identity.uid !== "string" ||
    !identity.uid ||
    typeof identity.companyId !== "string" ||
    !identity.companyId ||
    identity.isSuperUser !== false
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.IDENTITY_INVALID,
      "[deleteStandaloneRegisteredUser] verified actor identity is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
}

function snapshotData(snapshot, label) {
  if (!snapshot?.exists) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.TARGET_NOT_FOUND,
      `[deleteStandaloneRegisteredUser] ${label} was not found`,
      LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_NOT_FOUND,
    );
  }
  return snapshot.data();
}

function queryDocuments(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.docs)) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.DEPENDENCY_INVALID,
      "[deleteStandaloneRegisteredUser] query snapshot is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
    );
  }
  return snapshot.docs;
}

function assertExactReservation(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[deleteStandaloneRegisteredUser] email reservation is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    expectedKeys.some((key) => value[key] !== expected[key])
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[deleteStandaloneRegisteredUser] email reservation is inconsistent",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
}

function assertStandaloneRelationship({
  companyId,
  actorUid,
  targetUserId,
  targetSnapshot,
  employeeReservationsSnapshot,
  targetAuthIsSuperUser,
}) {
  const targetUser = snapshotData(targetSnapshot, "target User");
  assertStandaloneRegisteredUserDeletionTarget({
    companyId,
    actorUid,
    targetUserId,
    targetUser,
    targetAuthIsSuperUser,
  });
  if (targetUser.isTemporary === true) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.TEMPORARY_USER_LINKED,
      "[deleteStandaloneRegisteredUser] temporary target is not supported",
      LIFECYCLE_DOMAIN_ERROR_CODES.TEMPORARY_USER_LINKED,
    );
  }
  if (
    targetUser.isTemporary !== false ||
    typeof targetUser.email !== "string" ||
    targetUser.email.trim().toLowerCase() !== targetUser.email ||
    typeof targetUser.displayName !== "string" ||
    queryDocuments(employeeReservationsSnapshot).length !== 0
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[deleteStandaloneRegisteredUser] standalone User relation is inconsistent",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  return targetUser;
}

function assertActor({ companyId, actorSnapshot }) {
  if (!actorSnapshot?.exists) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.IDENTITY_INVALID,
      "[deleteStandaloneRegisteredUser] actor User was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  const actorUser = actorSnapshot.data();
  assertStandaloneRegisteredUserDeletionActor({ companyId, actorUser });
  if (typeof actorUser.displayName !== "string") {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.IDENTITY_INVALID,
      "[deleteStandaloneRegisteredUser] actor display name is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  return actorUser;
}

function assertExistingOperation({ operation, identity, input, fingerprint }) {
  if (
    operation.operationType !==
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION ||
    operation.actorUid !== identity.uid ||
    operation.targetUserUid !== input.targetUserId ||
    operation.requestFingerprint !== fingerprint
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.OPERATION_ID_CONFLICT,
      "[deleteStandaloneRegisteredUser] operation ID is already in use",
      LIFECYCLE_DOMAIN_ERROR_CODES.OPERATION_ID_CONFLICT,
    );
  }
}

function responseFromOperation(operation) {
  return Object.freeze({
    success: true,
    operationId: operation.operationId,
    status:
      operation.state === LIFECYCLE_OPERATION_STATES.COMPLETED
        ? "completed"
        : "completed-cleanup-pending",
    userId: operation.targetUserUid,
  });
}

function inertAuthGateway() {
  const unexpected = async () => {
    throw new Error(
      "[deleteStandaloneRegisteredUser] Auth phase was unexpectedly invoked",
    );
  };
  return Object.freeze({
    disableAndVerify: unexpected,
    revalidateAndDelete: unexpected,
  });
}

export async function deleteStandaloneRegisteredUser({
  firestore,
  auth,
  cleanupFcm,
  identity,
  input,
  store = null,
} = {}) {
  assertDependencies({ firestore, auth, cleanupFcm });
  assertIdentity(identity);
  const normalizedInput = resolveStandaloneRegisteredUserDeletionInput(input);
  const fingerprint = createLifecycleRequestFingerprint({
    actorUid: identity.uid,
    operationType:
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    normalizedInput: {
      targetUserId: normalizedInput.targetUserId,
      reason: normalizedInput.reason,
    },
  });
  const companyId = identity.companyId;
  const targetUserId = normalizedInput.targetUserId;
  const operationRef = firestore.doc(
    lifecycleOperationPath(companyId, normalizedInput.operationId),
  );
  const lifecycleStore =
    store ?? createFirestoreLifecycleOperationStore({ firestore });

  const existingSnapshot = await operationRef.get();
  let existingOperation = null;
  if (existingSnapshot.exists) {
    existingOperation = assertLifecycleOperationRecord(existingSnapshot.data());
    assertExistingOperation({
      operation: existingOperation,
      identity,
      input: normalizedInput,
      fingerprint,
    });
    if (existingOperation.state === LIFECYCLE_OPERATION_STATES.COMPLETED) {
      return responseFromOperation(existingOperation);
    }
  }
  if (existingOperation?.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED) {
    const resumed = await runRegisteredUserDeletion({
      store: lifecycleStore,
      authGateway: inertAuthGateway(),
      cleanupFcm,
      mutations: { accessRevoke() {}, finalizeData() {} },
      companyId,
      operationInput: existingOperation,
    });
    return responseFromOperation(resumed.operation);
  }

  const actorRef = firestore.doc(`Companies/${companyId}/Users/${identity.uid}`);
  const targetRef = firestore.doc(`Companies/${companyId}/Users/${targetUserId}`);
  const employeeReservationsQuery = firestore
    .collection(`Companies/${companyId}/EmployeeUserReservations`)
    .where("userId", "==", targetUserId)
    .limit(1);
  const [actorSnapshot, targetSnapshot, employeeReservationsSnapshot] =
    await Promise.all([
      actorRef.get(),
      targetRef.get(),
      employeeReservationsQuery.get(),
    ]);
  const actorUser = assertActor({ companyId, actorSnapshot });
  const targetUser = snapshotData(targetSnapshot, "target User");
  if (
    typeof targetUser.email !== "string" ||
    targetUser.email.trim().toLowerCase() !== targetUser.email
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[deleteStandaloneRegisteredUser] target email is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  const emailReservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(targetUser.email)}`,
  );
  const emailReservationSnapshot = await emailReservationRef.get();
  assertExactReservation(snapshotData(emailReservationSnapshot, "email reservation"), {
    companyId,
    userId: targetUserId,
  });

  let targetAuth;
  try {
    targetAuth = await auth.getUser(targetUserId);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      fail(
        DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
        "[deleteStandaloneRegisteredUser] target Auth was not found",
        LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
        { cause: error },
      );
    }
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.DEPENDENCY_INVALID,
      "[deleteStandaloneRegisteredUser] target Auth lookup failed",
      LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE,
      { cause: error },
    );
  }
  const targetAuthIsSuperUser = targetAuth.customClaims?.isSuperUser;
  assertStandaloneRelationship({
    companyId,
    actorUid: identity.uid,
    targetUserId,
    targetSnapshot,
    employeeReservationsSnapshot,
    targetAuthIsSuperUser,
  });
  const authGateway = createRegisteredUserAuthGateway({
    auth,
    companyId,
    expectedUid: targetUserId,
    expectedEmail: targetUser.email,
  });
  if (existingOperation === null) await authGateway.verifyTarget();

  const operationInput = existingOperation ?? {
    operationId: normalizedInput.operationId,
    operationType:
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    actorUid: identity.uid,
    actorDisplayName: actorUser.displayName,
    targetUserUid: targetUserId,
    targetDisplayName: targetUser.displayName,
    offboardingReason: normalizedInput.reason,
    requestFingerprint: fingerprint,
  };
  const reads = [
    { key: "actor", reference: actorRef },
    { key: "targetUser", reference: targetRef },
    { key: "employeeReservations", reference: employeeReservationsQuery },
    { key: "emailReservation", reference: emailReservationRef },
  ];
  const result = await runRegisteredUserDeletion({
    store: lifecycleStore,
    authGateway,
    cleanupFcm,
    companyId,
    operationInput,
    reads: { accessRevoke: reads, finalizeData: reads.slice(1) },
    mutations: {
      accessRevoke: ({ write, reads: snapshots }) => {
        assertActor({ companyId, actorSnapshot: snapshots.actor });
        const target = assertStandaloneRelationship({
          companyId,
          actorUid: identity.uid,
          targetUserId,
          targetSnapshot: snapshots.targetUser,
          employeeReservationsSnapshot: snapshots.employeeReservations,
          targetAuthIsSuperUser: false,
        });
        assertExactReservation(snapshots.emailReservation.data(), {
          companyId,
          userId: targetUserId,
        });
        if (target.email !== targetUser.email) {
          fail(
            DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
            "[deleteStandaloneRegisteredUser] target email changed",
            LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
          );
        }
        write.update(targetRef, { disabled: true });
      },
      finalizeData: ({ write, reads: snapshots }) => {
        const target = assertStandaloneRelationship({
          companyId,
          actorUid: identity.uid,
          targetUserId,
          targetSnapshot: snapshots.targetUser,
          employeeReservationsSnapshot: snapshots.employeeReservations,
          targetAuthIsSuperUser: false,
        });
        assertExactReservation(snapshots.emailReservation.data(), {
          companyId,
          userId: targetUserId,
        });
        if (target.disabled !== true || target.email !== targetUser.email) {
          fail(
            DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
            "[deleteStandaloneRegisteredUser] revoked target changed",
            LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
          );
        }
        write.delete(targetRef);
        write.delete(emailReservationRef);
      },
    },
  });
  return responseFromOperation(result.operation);
}

/** 保存済みUWB-07B operationをservice identityで再開します。 */
export async function resumeStandaloneRegisteredUserDeletionOperation({
  firestore,
  auth,
  cleanupFcm,
  companyId,
  operation,
  store = null,
} = {}) {
  assertDependencies({ firestore, auth, cleanupFcm });
  const persisted = assertLifecycleOperationRecord(operation);
  if (
    persisted.operationType !==
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION ||
    persisted.targetUserUid === null ||
    persisted.employeeId !== null ||
    typeof companyId !== "string" ||
    !companyId
  ) {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.IDENTITY_INVALID,
      "[resumeStandaloneRegisteredUserDeletionOperation] persisted operation is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
    );
  }
  if (persisted.state === LIFECYCLE_OPERATION_STATES.COMPLETED) {
    return responseFromOperation(persisted);
  }
  const lifecycleStore =
    store ?? createFirestoreLifecycleOperationStore({ firestore });
  if (persisted.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED) {
    const resumed = await runRegisteredUserDeletion({
      store: lifecycleStore,
      authGateway: inertAuthGateway(),
      cleanupFcm,
      mutations: { accessRevoke() {}, finalizeData() {} },
      companyId,
      operationInput: persisted,
    });
    return responseFromOperation(resumed.operation);
  }

  const targetUserId = persisted.targetUserUid;
  const targetRef = firestore.doc(`Companies/${companyId}/Users/${targetUserId}`);
  const targetSnapshot = await targetRef.get();
  const targetUser = snapshotData(targetSnapshot, "target User");
  if (typeof targetUser.email !== "string") {
    fail(
      DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[resumeStandaloneRegisteredUserDeletionOperation] target email is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  const emailReservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(targetUser.email)}`,
  );
  const employeeReservationsQuery = firestore
    .collection(`Companies/${companyId}/EmployeeUserReservations`)
    .where("userId", "==", targetUserId)
    .limit(1);
  const authGateway = createRegisteredUserAuthGateway({
    auth,
    companyId,
    expectedUid: targetUserId,
    expectedEmail: targetUser.email,
  });
  const finalizeReads = [
    { key: "targetUser", reference: targetRef },
    { key: "employeeReservations", reference: employeeReservationsQuery },
    { key: "emailReservation", reference: emailReservationRef },
  ];
  const result = await runRegisteredUserDeletion({
    store: lifecycleStore,
    authGateway,
    cleanupFcm,
    companyId,
    operationInput: persisted,
    reads: { finalizeData: finalizeReads },
    mutations: {
      accessRevoke() {},
      finalizeData: ({ write, reads }) => {
        const target = assertStandaloneRelationship({
          companyId,
          actorUid: persisted.actorUid,
          targetUserId,
          targetSnapshot: reads.targetUser,
          employeeReservationsSnapshot: reads.employeeReservations,
          targetAuthIsSuperUser: false,
        });
        assertExactReservation(
          snapshotData(reads.emailReservation, "email reservation"),
          { companyId, userId: targetUserId },
        );
        if (target.disabled !== true || target.email !== targetUser.email) {
          fail(
            DELETE_STANDALONE_REGISTERED_USER_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
            "[resumeStandaloneRegisteredUserDeletionOperation] revoked target changed",
            LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
          );
        }
        write.delete(targetRef);
        write.delete(emailReservationRef);
      },
    },
  });
  return responseFromOperation(result.operation);
}
