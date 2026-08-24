/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/terminateEmployee.js
 * @description UWB-07A Employee退職use-caseです。予約pointerを関係の正本とし、
 * Employee-onlyと本登録User連携の退職を分離します。
 *****************************************************************************/
import { createUserEmailReservationId } from "../createTemporaryUser.js";
import {
  assertEmployeeRetirementActor,
  assertEmployeeRetirementTarget,
  resolveEmployeeRetirementInput,
} from "../policies/userLifecyclePolicy.js";
import { createRegisteredUserAuthGateway } from "./registeredUserAuthGateway.js";
import {
  assertLifecycleOperationRecord,
  createLifecycleRequestFingerprint,
  createNextEmployeeLifecycleHead,
  employeeLifecycleHeadPath,
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
  lifecycleOperationPath,
} from "./lifecycleOperationSchema.js";
import { createFirestoreLifecycleOperationStore } from "./lifecycleOperationStore.js";
import { runRegisteredUserDeletion } from "./registeredUserDeletionEngine.js";

export const TERMINATE_EMPLOYEE_ERROR_CODES = Object.freeze({
  DEPENDENCY_INVALID: "dependency-invalid",
  IDENTITY_INVALID: "identity-invalid",
  TARGET_NOT_FOUND: "target-not-found",
  RELATIONSHIP_INCONSISTENT: "relationship-inconsistent",
  TEMPORARY_USER_LINKED: "temporary-user-linked",
  ADMIN_TARGET_DENIED: "admin-target-denied",
  OPERATION_ID_CONFLICT: "operation-id-conflict",
});

export class TerminateEmployeeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "TerminateEmployeeError";
    this.code = code;
    this.domainCode = options.domainCode ?? LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL;
  }
}

function fail(code, message, domainCode, options = {}) {
  throw new TerminateEmployeeError(code, message, {
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
      TERMINATE_EMPLOYEE_ERROR_CODES.DEPENDENCY_INVALID,
      "[terminateEmployee] dependencies are invalid",
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
      TERMINATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
      "[terminateEmployee] verified actor identity is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
}

function snapshotData(
  snapshot,
  { missingCode, label, domainCode = LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_NOT_FOUND },
) {
  if (!snapshot?.exists) {
    fail(
      missingCode,
      `[terminateEmployee] ${label} was not found`,
      domainCode,
    );
  }
  return snapshot.data();
}

function queryDocuments(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.docs)) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.DEPENDENCY_INVALID,
      "[terminateEmployee] query snapshot is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
    );
  }
  return snapshot.docs;
}

function snapshotId(snapshot) {
  return snapshot?.id ?? snapshot?.ref?.id ?? null;
}

function assertExactReservation(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      `[terminateEmployee] ${label} reservation is invalid`,
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
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      `[terminateEmployee] ${label} reservation does not match target`,
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
}

function toDateOnly(value) {
  if (typeof value === "string") return value;
  const date = value instanceof Date ? value : value?.toDate?.();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOnlyToJstDate(value) {
  return new Date(`${value}T00:00:00+09:00`);
}

function currentJstDateOnly(now = new Date()) {
  return toDateOnly(now);
}

function assertActorAndEmployee({
  companyId,
  actorUid,
  employeeId,
  actorSnapshot,
  employeeSnapshot,
  terminationDate,
  serverTodayJst,
  existingOperation = null,
}) {
  const actorUser = snapshotData(actorSnapshot, {
    missingCode: TERMINATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
    label: "actor User",
    domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
  });
  const employee = snapshotData(employeeSnapshot, {
    missingCode: TERMINATE_EMPLOYEE_ERROR_CODES.TARGET_NOT_FOUND,
    label: "Employee",
  });
  assertEmployeeRetirementActor({ companyId, actorUser, employeeId });
  if (existingOperation === null) {
    assertEmployeeRetirementTarget({
      employee: { ...employee, dateOfHire: toDateOnly(employee.dateOfHire) },
      terminationDate,
      serverTodayJst,
    });
  } else if (
    employee.employmentStatus !== "RESIGNED" ||
    toDateOnly(employee.dateOfTermination) !== existingOperation.terminationDate ||
    employee.reasonOfTermination !== existingOperation.reasonOfTermination
  ) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] persisted Employee retirement does not match operation",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  if (typeof actorUser.displayName !== "string") {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
      "[terminateEmployee] actor display name is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  return { actorUser, employee };
}

function assertEmployeeOnlyRelationship({ reservationSnapshot, usersSnapshot }) {
  if (reservationSnapshot?.exists || queryDocuments(usersSnapshot).length !== 0) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] Employee-only relationship is inconsistent",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
}

function assertRegisteredRelationship({
  companyId,
  employeeId,
  targetUserUid,
  reservationSnapshot,
  usersSnapshot,
  targetUserSnapshot,
  emailReservationSnapshot,
}) {
  if (!reservationSnapshot?.exists) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] Employee reservation was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  assertExactReservation(
    reservationSnapshot.data(),
    { userId: targetUserUid },
    "Employee",
  );
  const userDocuments = queryDocuments(usersSnapshot);
  if (
    userDocuments.length !== 1 ||
    snapshotId(userDocuments[0]) !== targetUserUid
  ) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] Employee User relation is not unique",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  const targetUser = snapshotData(targetUserSnapshot, {
    missingCode: TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    label: "reserved User",
  });
  if (targetUser.isTemporary === true) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.TEMPORARY_USER_LINKED,
      "[terminateEmployee] temporary User must be deleted before retirement",
      LIFECYCLE_DOMAIN_ERROR_CODES.TEMPORARY_USER_LINKED,
    );
  }
  if (
    targetUser.isTemporary !== false ||
    targetUser.companyId !== companyId ||
    targetUser.employeeId !== employeeId ||
    typeof targetUser.disabled !== "boolean" ||
    typeof targetUser.isAdmin !== "boolean" ||
    typeof targetUser.email !== "string" ||
    targetUser.email.trim().toLowerCase() !== targetUser.email ||
    typeof targetUser.displayName !== "string"
  ) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] registered User relation is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  if (targetUser.isAdmin) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.ADMIN_TARGET_DENIED,
      "[terminateEmployee] company administrator cannot be retired",
      LIFECYCLE_DOMAIN_ERROR_CODES.ADMIN_TARGET_DENIED,
    );
  }
  assertExactReservation(
    snapshotData(emailReservationSnapshot, {
      missingCode: TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      label: "email reservation",
    }),
    { companyId, userId: targetUserUid },
    "email",
  );
  return targetUser;
}

function assertExistingOperation({ operation, identity, input, fingerprint }) {
  if (
    operation.operationType !== LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT ||
    operation.actorUid !== identity.uid ||
    operation.employeeId !== input.employeeId ||
    operation.requestFingerprint !== fingerprint
  ) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.OPERATION_ID_CONFLICT,
      "[terminateEmployee] operation ID is already used by another request",
      LIFECYCLE_DOMAIN_ERROR_CODES.OPERATION_ID_CONFLICT,
    );
  }
}

function responseFromOperation(operation) {
  const registered = operation.targetUserUid !== null;
  return Object.freeze({
    success: true,
    operationId: operation.operationId,
    status:
      operation.state === LIFECYCLE_OPERATION_STATES.COMPLETED
        ? "completed"
        : "completed-cleanup-pending",
    employeeId: operation.employeeId,
    userDeletion: Object.freeze({
      kind: registered ? "registered" : "none",
      userAccessDeleted:
        registered &&
        [
          LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
          LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
        ].includes(operation.authDisposition) &&
        [
          LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
          LIFECYCLE_OPERATION_STATES.COMPLETED,
        ].includes(operation.state),
    }),
  });
}

function inertAuthGateway() {
  const unexpected = async () => {
    throw new Error("[terminateEmployee] Auth phase was unexpectedly invoked");
  };
  return Object.freeze({
    disableAndVerify: unexpected,
    revalidateAndDelete: unexpected,
  });
}

export async function terminateEmployee({
  firestore,
  auth,
  cleanupFcm,
  identity,
  input,
  serverTodayJst = currentJstDateOnly(),
  store = null,
} = {}) {
  assertDependencies({ firestore, auth, cleanupFcm });
  assertIdentity(identity);
  const normalizedInput = resolveEmployeeRetirementInput(input);
  const fingerprint = createLifecycleRequestFingerprint({
    actorUid: identity.uid,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    normalizedInput: {
      employeeId: normalizedInput.employeeId,
      terminationDate: normalizedInput.terminationDate,
      reasonOfTermination: normalizedInput.reasonOfTermination,
    },
  });
  const companyId = identity.companyId;
  const actorRef = firestore.doc(`Companies/${companyId}/Users/${identity.uid}`);
  const employeeRef = firestore.doc(
    `Companies/${companyId}/Employees/${normalizedInput.employeeId}`,
  );
  const employeeReservationRef = firestore.doc(
    `Companies/${companyId}/EmployeeUserReservations/${normalizedInput.employeeId}`,
  );
  const employeeUsersQuery = firestore
    .collection(`Companies/${companyId}/Users`)
    .where("employeeId", "==", normalizedInput.employeeId)
    .limit(2);
  const operationRef = firestore.doc(
    lifecycleOperationPath(companyId, normalizedInput.operationId),
  );
  const headRef = firestore.doc(
    employeeLifecycleHeadPath(companyId, normalizedInput.employeeId),
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

  if (
    existingOperation?.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED
  ) {
    const resumed = await runRegisteredUserDeletion({
      store: lifecycleStore,
      authGateway: inertAuthGateway(),
      cleanupFcm,
      mutations: {
        accessRevoke() {},
        finalizeData() {},
      },
      companyId,
      operationInput: existingOperation,
    });
    return responseFromOperation(resumed.operation);
  }

  const [actorSnapshot, employeeSnapshot, reservationSnapshot, usersSnapshot] =
    await Promise.all([
      actorRef.get(),
      employeeRef.get(),
      employeeReservationRef.get(),
      employeeUsersQuery.get(),
    ]);
  const { actorUser } = assertActorAndEmployee({
    companyId,
    actorUid: identity.uid,
    employeeId: normalizedInput.employeeId,
    actorSnapshot,
    employeeSnapshot,
    terminationDate: normalizedInput.terminationDate,
    serverTodayJst,
    existingOperation,
  });

  const operationBase = {
    operationId: normalizedInput.operationId,
    actorUid: identity.uid,
    actorDisplayName: actorUser.displayName,
    employeeId: normalizedInput.employeeId,
    terminationDate: normalizedInput.terminationDate,
    reasonOfTermination: normalizedInput.reasonOfTermination,
    requestFingerprint: fingerprint,
  };
  const employeeUpdate = {
    employmentStatus: "RESIGNED",
    dateOfTermination: dateOnlyToJstDate(normalizedInput.terminationDate),
    reasonOfTermination: normalizedInput.reasonOfTermination,
  };

  if (!reservationSnapshot.exists && existingOperation === null) {
    assertEmployeeOnlyRelationship({ reservationSnapshot, usersSnapshot });
    const result = await lifecycleStore.completeEmployeeOnlyRetirement({
      companyId,
      operationInput: operationBase,
      readRequests: [
        { key: "actor", reference: actorRef },
        { key: "employee", reference: employeeRef },
        { key: "employeeReservation", reference: employeeReservationRef },
        { key: "employeeUsers", reference: employeeUsersQuery },
      ],
      mutation: ({ write, reads }) => {
        assertActorAndEmployee({
          companyId,
          actorUid: identity.uid,
          employeeId: normalizedInput.employeeId,
          actorSnapshot: reads.actor,
          employeeSnapshot: reads.employee,
          terminationDate: normalizedInput.terminationDate,
          serverTodayJst,
        });
        assertEmployeeOnlyRelationship({
          reservationSnapshot: reads.employeeReservation,
          usersSnapshot: reads.employeeUsers,
        });
        write.update(employeeRef, employeeUpdate);
      },
    });
    return responseFromOperation(result.operation);
  }

  const targetUserUid = existingOperation?.targetUserUid ??
    reservationSnapshot.data()?.userId;
  if (typeof targetUserUid !== "string" || !targetUserUid) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] Employee reservation target is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  const targetUserRef = firestore.doc(
    `Companies/${companyId}/Users/${targetUserUid}`,
  );
  const targetUserSnapshot = await targetUserRef.get();
  const targetUserData = targetUserSnapshot.exists
    ? targetUserSnapshot.data()
    : null;
  const emailReservationRef = targetUserData?.email
    ? firestore.doc(
        `UserEmailReservations/${createUserEmailReservationId(targetUserData.email)}`,
      )
    : null;
  if (!emailReservationRef) {
    fail(
      TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[terminateEmployee] registered User email is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
  const emailReservationSnapshot = await emailReservationRef.get();
  const targetUser = assertRegisteredRelationship({
    companyId,
    employeeId: normalizedInput.employeeId,
    targetUserUid,
    reservationSnapshot,
    usersSnapshot,
    targetUserSnapshot,
    emailReservationSnapshot,
  });
  const authGateway = createRegisteredUserAuthGateway({
    auth,
    companyId,
    expectedUid: targetUserUid,
    expectedEmail: targetUser.email,
  });
  if (existingOperation === null) await authGateway.verifyTarget();

  const operationInput = existingOperation ?? {
    ...operationBase,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    targetUserUid,
    targetDisplayName: targetUser.displayName,
  };
  const accessReads = [
    { key: "actor", reference: actorRef },
    { key: "employee", reference: employeeRef },
    { key: "employeeReservation", reference: employeeReservationRef },
    { key: "employeeUsers", reference: employeeUsersQuery },
    { key: "targetUser", reference: targetUserRef },
    { key: "emailReservation", reference: emailReservationRef },
    { key: "head", reference: headRef },
  ];
  const finalizeReads = [
    { key: "employee", reference: employeeRef },
    { key: "employeeReservation", reference: employeeReservationRef },
    { key: "employeeUsers", reference: employeeUsersQuery },
    { key: "targetUser", reference: targetUserRef },
    { key: "emailReservation", reference: emailReservationRef },
    { key: "head", reference: headRef },
  ];

  const result = await runRegisteredUserDeletion({
    store: lifecycleStore,
    authGateway,
    cleanupFcm,
    companyId,
    operationInput,
    reads: {
      accessRevoke: accessReads,
      finalizeData: finalizeReads,
    },
    mutations: {
      accessRevoke: ({ write, operation, timestamp, reads }) => {
        assertActorAndEmployee({
          companyId,
          actorUid: identity.uid,
          employeeId: normalizedInput.employeeId,
          actorSnapshot: reads.actor,
          employeeSnapshot: reads.employee,
          terminationDate: normalizedInput.terminationDate,
          serverTodayJst,
        });
        assertRegisteredRelationship({
          companyId,
          employeeId: normalizedInput.employeeId,
          targetUserUid,
          reservationSnapshot: reads.employeeReservation,
          usersSnapshot: reads.employeeUsers,
          targetUserSnapshot: reads.targetUser,
          emailReservationSnapshot: reads.emailReservation,
        });
        const currentHead = reads.head.exists ? reads.head.data() : null;
        const head = createNextEmployeeLifecycleHead({
          currentHead,
          operationId: operation.operationId,
          operationType: operation.operationType,
          timestamp,
        });
        write.update(employeeRef, employeeUpdate);
        write.update(targetUserRef, { disabled: true });
        write.set(headRef, head);
      },
      finalizeData: ({ write, operation, reads }) => {
        const finalTarget = assertRegisteredRelationship({
          companyId,
          employeeId: normalizedInput.employeeId,
          targetUserUid,
          reservationSnapshot: reads.employeeReservation,
          usersSnapshot: reads.employeeUsers,
          targetUserSnapshot: reads.targetUser,
          emailReservationSnapshot: reads.emailReservation,
        });
        const employee = snapshotData(reads.employee, {
          missingCode: TERMINATE_EMPLOYEE_ERROR_CODES.TARGET_NOT_FOUND,
          label: "Employee",
        });
        const head = reads.head?.exists ? reads.head.data() : null;
        if (
          finalTarget.disabled !== true ||
          employee.employmentStatus !== "RESIGNED" ||
          toDateOnly(employee.dateOfTermination) !== normalizedInput.terminationDate ||
          employee.reasonOfTermination !== normalizedInput.reasonOfTermination ||
          head?.latestOperationId !== operation.operationId ||
          head?.latestOperationType !== operation.operationType
        ) {
          fail(
            TERMINATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
            "[terminateEmployee] retirement state changed before finalize",
            LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
          );
        }
        write.delete(targetUserRef);
        write.delete(emailReservationRef);
        write.delete(employeeReservationRef);
      },
    },
  });
  return responseFromOperation(result.operation);
}
