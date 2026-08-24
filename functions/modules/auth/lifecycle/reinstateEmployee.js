/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/reinstateEmployee.js
 * @description UWB-07C 誤退職訂正use-caseです。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import {
  assertEmployeeReinstatementActor,
  assertEmployeeReinstatementTarget,
  resolveEmployeeReinstatementInput,
} from "../policies/userLifecyclePolicy.js";
import {
  assertEmployeeLifecycleHeadRecord,
  assertLifecycleOperationRecord,
  createLifecycleRequestFingerprint,
  employeeLifecycleHeadPath,
  LIFECYCLE_CLEANUP_STATES,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
  lifecycleOperationPath,
} from "./lifecycleOperationSchema.js";
import { createFirestoreLifecycleOperationStore } from "./lifecycleOperationStore.js";

export const REINSTATE_EMPLOYEE_ERROR_CODES = Object.freeze({
  DEPENDENCY_INVALID: "dependency-invalid",
  IDENTITY_INVALID: "identity-invalid",
  TARGET_NOT_FOUND: "target-not-found",
  SOURCE_OPERATION_NOT_FOUND: "source-operation-not-found",
  SOURCE_NOT_COMPLETED: "source-not-completed",
  ALREADY_REINSTATED: "already-reinstated",
  LATEST_OPERATION_MISMATCH: "latest-operation-mismatch",
  RELATIONSHIP_INCONSISTENT: "relationship-inconsistent",
  OPERATION_ID_CONFLICT: "operation-id-conflict",
});

export class ReinstateEmployeeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "ReinstateEmployeeError";
    this.code = code;
    this.domainCode = options.domainCode ?? LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL;
  }
}

function fail(code, message, domainCode, options = {}) {
  throw new ReinstateEmployeeError(code, message, {
    ...options,
    domainCode,
  });
}

function assertDependencies({ firestore, deleteFieldFactory, store }) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function" ||
    typeof firestore.runTransaction !== "function" ||
    typeof deleteFieldFactory !== "function" ||
    (store !== null &&
      typeof store?.completeEmployeeReinstatement !== "function")
  ) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.DEPENDENCY_INVALID,
      "[reinstateEmployee] dependencies are invalid",
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
      REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
      "[reinstateEmployee] verified actor identity is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
}

function snapshotData(snapshot, code, label, domainCode) {
  if (!snapshot?.exists) {
    fail(code, `[reinstateEmployee] ${label} was not found`, domainCode);
  }
  return snapshot.data();
}

export function assertEmployeeReinstatementNoUserRelationship({
  reservationSnapshot,
  usersSnapshot,
}) {
  if (
    reservationSnapshot?.exists ||
    !usersSnapshot ||
    !Array.isArray(usersSnapshot.docs) ||
    usersSnapshot.docs.length !== 0
  ) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
      "[reinstateEmployee] Employee has an active User relationship",
      LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
    );
  }
}

export function assertEmployeeReinstatementSourceAndHead({
  sourceSnapshot,
  currentHead,
  employeeId,
  reversesOperationId,
}) {
  const source = assertLifecycleOperationRecord(
    snapshotData(
      sourceSnapshot,
      REINSTATE_EMPLOYEE_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND,
      "source operation",
      LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND,
    ),
  );
  if (
    source.operationType !== LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT ||
    source.employeeId !== employeeId ||
    source.state !== LIFECYCLE_OPERATION_STATES.COMPLETED ||
    ![
      LIFECYCLE_CLEANUP_STATES.COMPLETED,
      LIFECYCLE_CLEANUP_STATES.NOT_APPLICABLE,
    ].includes(source.cleanupState)
  ) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.SOURCE_NOT_COMPLETED,
      "[reinstateEmployee] source retirement is not completed",
      LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_NOT_COMPLETED,
    );
  }
  if (source.operationId !== reversesOperationId) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.LATEST_OPERATION_MISMATCH,
      "[reinstateEmployee] reverse source does not match request",
      LIFECYCLE_DOMAIN_ERROR_CODES.LATEST_OPERATION_MISMATCH,
    );
  }
  if (currentHead === null) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.LATEST_OPERATION_MISMATCH,
      "[reinstateEmployee] Employee lifecycle head was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.LATEST_OPERATION_MISMATCH,
    );
  }
  const head = assertEmployeeLifecycleHeadRecord(currentHead);
  if (
    head.latestOperationId !== source.operationId ||
    head.latestOperationType !== LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
  ) {
    fail(
      head.latestOperationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT
        ? REINSTATE_EMPLOYEE_ERROR_CODES.ALREADY_REINSTATED
        : REINSTATE_EMPLOYEE_ERROR_CODES.LATEST_OPERATION_MISMATCH,
      "[reinstateEmployee] source is not the latest Employee operation",
      head.latestOperationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT
        ? LIFECYCLE_DOMAIN_ERROR_CODES.ALREADY_REINSTATED
        : LIFECYCLE_DOMAIN_ERROR_CODES.LATEST_OPERATION_MISMATCH,
    );
  }
  return source;
}

function assertExistingOperation({ operation, identity, input, fingerprint }) {
  if (
    operation.operationType !== LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT ||
    operation.actorUid !== identity.uid ||
    operation.employeeId !== input.employeeId ||
    operation.reversesOperationId !== input.reversesOperationId ||
    operation.requestFingerprint !== fingerprint
  ) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.OPERATION_ID_CONFLICT,
      "[reinstateEmployee] operation ID is already in use",
      LIFECYCLE_DOMAIN_ERROR_CODES.OPERATION_ID_CONFLICT,
    );
  }
}

function responseFromOperation(operation, source) {
  return Object.freeze({
    success: true,
    operationId: operation.operationId,
    status: "completed",
    employeeId: operation.employeeId,
    employeeReinstated: true,
    userAccessRestored: false,
    requiresUserReprovisioning: source.targetUserUid !== null,
  });
}

export async function reinstateEmployee({
  firestore,
  identity,
  input,
  store = null,
  deleteFieldFactory = () => FieldValue.delete(),
} = {}) {
  assertDependencies({ firestore, deleteFieldFactory, store });
  assertIdentity(identity);
  const normalizedInput = resolveEmployeeReinstatementInput(input);
  const fingerprint = createLifecycleRequestFingerprint({
    actorUid: identity.uid,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT,
    normalizedInput: {
      employeeId: normalizedInput.employeeId,
      reversesOperationId: normalizedInput.reversesOperationId,
      correctionReasonCode: normalizedInput.correctionReasonCode,
    },
  });
  const companyId = identity.companyId;
  const operationRef = firestore.doc(
    lifecycleOperationPath(companyId, normalizedInput.operationId),
  );
  const sourceRef = firestore.doc(
    lifecycleOperationPath(companyId, normalizedInput.reversesOperationId),
  );
  const employeeRef = firestore.doc(
    `Companies/${companyId}/Employees/${normalizedInput.employeeId}`,
  );
  const actorRef = firestore.doc(`Companies/${companyId}/Users/${identity.uid}`);
  const reservationRef = firestore.doc(
    `Companies/${companyId}/EmployeeUserReservations/${normalizedInput.employeeId}`,
  );
  const usersQuery = firestore
    .collection(`Companies/${companyId}/Users`)
    .where("employeeId", "==", normalizedInput.employeeId)
    .limit(1);
  const headRef = firestore.doc(
    employeeLifecycleHeadPath(companyId, normalizedInput.employeeId),
  );
  const lifecycleStore =
    store ?? createFirestoreLifecycleOperationStore({ firestore });

  const existingSnapshot = await operationRef.get();
  if (existingSnapshot.exists) {
    const existing = assertLifecycleOperationRecord(existingSnapshot.data());
    assertExistingOperation({
      operation: existing,
      identity,
      input: normalizedInput,
      fingerprint,
    });
    const sourceSnapshot = await sourceRef.get();
    const source = assertLifecycleOperationRecord(
      snapshotData(
        sourceSnapshot,
        REINSTATE_EMPLOYEE_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND,
        "source operation",
        LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND,
      ),
    );
    return responseFromOperation(existing, source);
  }

  const actorSnapshot = await actorRef.get();
  const actorUser = snapshotData(
    actorSnapshot,
    REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
    "actor User",
    LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
  );
  assertEmployeeReinstatementActor({ companyId, actorUser });
  if (typeof actorUser.displayName !== "string") {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
      "[reinstateEmployee] actor display name is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  const operationInput = {
    operationId: normalizedInput.operationId,
    actorUid: identity.uid,
    actorDisplayName: actorUser.displayName,
    employeeId: normalizedInput.employeeId,
    reversesOperationId: normalizedInput.reversesOperationId,
    correctionReasonCode: normalizedInput.correctionReasonCode,
    requestFingerprint: fingerprint,
  };
  let completedSource = null;
  const result = await lifecycleStore.completeEmployeeReinstatement({
    companyId,
    operationInput,
    readRequests: [
      { key: "actor", reference: actorRef },
      { key: "employee", reference: employeeRef },
      { key: "source", reference: sourceRef },
      { key: "employeeReservation", reference: reservationRef },
      { key: "employeeUsers", reference: usersQuery },
    ],
    mutation: ({ write, reads, currentHead, operation }) => {
      const actorUser = snapshotData(
        reads.actor,
        REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
        "actor User",
        LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
      );
      assertEmployeeReinstatementActor({ companyId, actorUser });
      if (
        typeof actorUser.displayName !== "string" ||
        actorUser.displayName !== operation.actorDisplayName
      ) {
        fail(
          REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
          "[reinstateEmployee] actor display name changed",
          LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
        );
      }
      const employee = snapshotData(
        reads.employee,
        REINSTATE_EMPLOYEE_ERROR_CODES.TARGET_NOT_FOUND,
        "Employee",
        LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_NOT_FOUND,
      );
      assertEmployeeReinstatementTarget({ employee });
      assertEmployeeReinstatementNoUserRelationship({
        reservationSnapshot: reads.employeeReservation,
        usersSnapshot: reads.employeeUsers,
      });
      completedSource = assertEmployeeReinstatementSourceAndHead({
        sourceSnapshot: reads.source,
        currentHead,
        employeeId: normalizedInput.employeeId,
        reversesOperationId: normalizedInput.reversesOperationId,
      });
      write.update(employeeRef, {
        employmentStatus: "ACTIVE",
        dateOfTermination: deleteFieldFactory(),
        reasonOfTermination: deleteFieldFactory(),
      });
    },
  });
  if (completedSource === null) {
    completedSource = assertLifecycleOperationRecord(
      snapshotData(
        await sourceRef.get(),
        REINSTATE_EMPLOYEE_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND,
        "source operation",
        LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND,
      ),
    );
  }
  return responseFromOperation(result.operation, completedSource);
}
