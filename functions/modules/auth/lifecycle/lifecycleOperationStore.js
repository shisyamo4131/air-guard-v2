/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/lifecycleOperationStore.js
 * @description UWB-07 lifecycle operation、event、lockをFirestore transaction
 * で一貫して更新するserver-only storeです。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import {
  assertLifecycleLockRecord,
  assertLifecycleOperationRecord,
  createEmployeeReinstatementOperationRecord,
  createEmployeeOnlyRetirementOperationRecord,
  createLifecycleEventRecord,
  createLifecycleLockRecord,
  createNextEmployeeLifecycleHead,
  createRegisteredUserDeletionOperationRecord,
  employeeLifecycleHeadPath,
  employeeLifecycleLockPath,
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_CLEANUP_STATES,
  LIFECYCLE_EVENT_OUTCOMES,
  LIFECYCLE_EVENT_PHASES,
  LIFECYCLE_OPERATION_STATES,
  lifecycleEventPath,
  lifecycleOperationPath,
  userLifecycleLockPath,
} from "./lifecycleOperationSchema.js";

export const LIFECYCLE_OPERATION_STORE_ERROR_CODES = Object.freeze({
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  TRANSACTION_INVALID: "transaction-invalid",
  MUTATION_INVALID: "mutation-invalid",
  OPERATION_NOT_FOUND: "operation-not-found",
  OPERATION_ID_CONFLICT: "operation-id-conflict",
  OPERATION_STATE_INVALID: "operation-state-invalid",
  TARGET_OPERATION_ACTIVE: "target-operation-active",
  EVENT_ALREADY_EXISTS: "event-already-exists",
  LOCK_MISSING: "lock-missing",
  LOCK_MISMATCH: "lock-mismatch",
});

export class LifecycleOperationStoreError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "LifecycleOperationStoreError";
    this.code = code;
  }
}

function fail(code, message, options = {}) {
  throw new LifecycleOperationStoreError(code, message, options);
}

function assertFirestore(firestore) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[lifecycleOperationStore] Firestore service is invalid",
    );
  }
}

function assertTransaction(transaction) {
  for (const method of ["get", "create", "set", "update", "delete"]) {
    if (typeof transaction?.[method] !== "function") {
      fail(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.TRANSACTION_INVALID,
        `[lifecycleOperationStore] transaction.${method} is required`,
      );
    }
  }
}

function createWriteOnlyTransaction(transaction) {
  return Object.freeze({
    create(reference, data) {
      transaction.create(reference, data);
    },
    set(reference, data) {
      transaction.set(reference, data);
    },
    update(reference, data) {
      transaction.update(reference, data);
    },
    delete(reference) {
      transaction.delete(reference);
    },
  });
}

function resolveReadRequests(readRequests = []) {
  if (!Array.isArray(readRequests)) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.MUTATION_INVALID,
      "[lifecycleOperationStore] readRequests must be an array",
    );
  }
  const keys = new Set();
  return readRequests.map((request) => {
    if (
      !request ||
      typeof request !== "object" ||
      typeof request.key !== "string" ||
      !request.key ||
      keys.has(request.key) ||
      !request.reference ||
      typeof request.reference !== "object"
    ) {
      fail(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.MUTATION_INVALID,
        "[lifecycleOperationStore] read request is invalid",
      );
    }
    keys.add(request.key);
    return Object.freeze({ key: request.key, reference: request.reference });
  });
}

async function readRequestedSnapshots(transaction, readRequests) {
  const entries = [];
  for (const request of readRequests) {
    entries.push([request.key, await transaction.get(request.reference)]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function applySynchronousMutation(mutation, context) {
  if (mutation === undefined) return;
  if (typeof mutation !== "function") {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.MUTATION_INVALID,
      "[lifecycleOperationStore] mutation must be a function",
    );
  }
  const result = mutation(context);
  if (result !== undefined) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.MUTATION_INVALID,
      "[lifecycleOperationStore] mutation must be synchronous and return undefined",
    );
  }
}

function operationLockPaths(companyId, operation) {
  const paths = [userLifecycleLockPath(companyId, operation.targetUserUid)];
  if (operation.employeeId !== null) {
    paths.push(employeeLifecycleLockPath(companyId, operation.employeeId));
  }
  return paths;
}

function assertLockOwnership(snapshot, operation) {
  if (!snapshot.exists) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.LOCK_MISSING,
      "[lifecycleOperationStore] lifecycle lock is missing",
    );
  }
  const lock = assertLifecycleLockRecord(snapshot.data());
  if (
    lock.operationId !== operation.operationId ||
    lock.operationType !== operation.operationType
  ) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.LOCK_MISMATCH,
      "[lifecycleOperationStore] lifecycle lock belongs to another operation",
    );
  }
}

function resolveExistingOperation(snapshot, expected) {
  const operation = assertLifecycleOperationRecord(snapshot.data());
  if (
    operation.operationId !== expected.operationId ||
    operation.operationType !== expected.operationType ||
    operation.actorUid !== expected.actorUid ||
    operation.requestFingerprint !== expected.requestFingerprint
  ) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_ID_CONFLICT,
      "[lifecycleOperationStore] operation ID is already used by another request",
    );
  }
  return operation;
}

function createNextOperation({
  current,
  nextState,
  authDisposition = current.authDisposition,
  cleanupState = current.cleanupState,
  phase,
  outcome,
  errorCode,
  timestamp,
}) {
  const failed = outcome === LIFECYCLE_EVENT_OUTCOMES.FAILED_RETRYABLE;
  const next = {
    ...current,
    state: nextState,
    authDisposition,
    cleanupState,
    attemptCount: current.attemptCount + 1,
    lastErrorPhase: failed ? phase : null,
    lastErrorCode: failed ? errorCode : null,
    updatedAt: timestamp,
    authDeletedAt:
      phase === "auth-delete" && !failed
        ? timestamp
        : current.authDeletedAt,
    dataFinalizedAt:
      nextState === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED && !failed
        ? (current.dataFinalizedAt ?? timestamp)
        : current.dataFinalizedAt,
    completedAt:
      nextState === LIFECYCLE_OPERATION_STATES.COMPLETED && !failed
        ? timestamp
        : current.completedAt,
  };
  return Object.freeze(assertLifecycleOperationRecord(next));
}

function assertRegisteredDeletionTransition({
  current,
  nextState,
  phase,
  outcome,
  authDisposition,
  cleanupState,
  releaseLocks,
  mutation,
}) {
  const failed = outcome === LIFECYCLE_EVENT_OUTCOMES.FAILED_RETRYABLE;
  const retryingSamePhase =
    current.state === LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE &&
    current.lastErrorPhase === phase;

  if (failed) {
    if (releaseLocks || mutation !== undefined) {
      fail(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
        "[lifecycleOperationStore] failure transition cannot mutate data or release locks",
      );
    }
    if (phase === LIFECYCLE_EVENT_PHASES.FCM_CLEANUP) {
      if (
        current.state !== LIFECYCLE_OPERATION_STATES.DATA_FINALIZED ||
        nextState !== LIFECYCLE_OPERATION_STATES.DATA_FINALIZED ||
        cleanupState !== LIFECYCLE_CLEANUP_STATES.FAILED
      ) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] cleanup failure transition is invalid",
        );
      }
      return;
    }
    if (
      ![
        LIFECYCLE_EVENT_PHASES.AUTH_DISABLE,
        LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT,
        LIFECYCLE_EVENT_PHASES.AUTH_DELETE,
        LIFECYCLE_EVENT_PHASES.DATA_FINALIZE,
      ].includes(phase) ||
      nextState !== LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE
    ) {
      fail(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
        "[lifecycleOperationStore] retryable failure transition is invalid",
      );
    }
    const validFailureOrigin =
      (phase === LIFECYCLE_EVENT_PHASES.AUTH_DISABLE &&
        (current.state ===
          LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING ||
          retryingSamePhase)) ||
      (phase === LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT &&
        (current.state === LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED ||
          retryingSamePhase)) ||
      (phase === LIFECYCLE_EVENT_PHASES.AUTH_DELETE &&
        ((current.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
          current.authDisposition === LIFECYCLE_AUTH_DISPOSITIONS.PRESENT) ||
          retryingSamePhase)) ||
      (phase === LIFECYCLE_EVENT_PHASES.DATA_FINALIZE &&
        ((current.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
          [
            LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
            LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
          ].includes(current.authDisposition)) ||
          retryingSamePhase));
    if (!validFailureOrigin) {
      fail(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
        "[lifecycleOperationStore] failure phase does not match current state",
      );
    }
    return;
  }

  switch (phase) {
    case LIFECYCLE_EVENT_PHASES.AUTH_DISABLE:
      if (
        !(
          current.state ===
            LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING ||
          retryingSamePhase
        ) ||
        nextState !== LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED
      ) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] Auth disable transition is invalid",
        );
      }
      break;
    case LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT:
      if (
        !(
          current.state === LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED ||
          retryingSamePhase
        ) ||
        nextState !== LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT
      ) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] Auth delete intent transition is invalid",
        );
      }
      break;
    case LIFECYCLE_EVENT_PHASES.AUTH_DELETE:
      if (
        !(
          (current.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
            current.authDisposition ===
              LIFECYCLE_AUTH_DISPOSITIONS.PRESENT) ||
          retryingSamePhase
        ) ||
        nextState !== LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT ||
        ![
          LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
          LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
        ].includes(authDisposition)
      ) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] Auth delete transition is invalid",
        );
      }
      break;
    case LIFECYCLE_EVENT_PHASES.DATA_FINALIZE:
      if (
        !(
          (current.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
            [
              LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
              LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
            ].includes(current.authDisposition)) ||
          retryingSamePhase
        ) ||
        nextState !== LIFECYCLE_OPERATION_STATES.DATA_FINALIZED ||
        typeof mutation !== "function"
      ) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] data finalize transition is invalid",
        );
      }
      break;
    case LIFECYCLE_EVENT_PHASES.FCM_CLEANUP:
      if (
        current.state !== LIFECYCLE_OPERATION_STATES.DATA_FINALIZED ||
        nextState !== LIFECYCLE_OPERATION_STATES.COMPLETED ||
        cleanupState !== LIFECYCLE_CLEANUP_STATES.COMPLETED ||
        releaseLocks !== true
      ) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] cleanup completion transition is invalid",
        );
      }
      break;
    default:
      fail(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
        "[lifecycleOperationStore] phase is not a registered deletion transition",
      );
  }

  if (phase !== LIFECYCLE_EVENT_PHASES.DATA_FINALIZE && mutation !== undefined) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
      "[lifecycleOperationStore] mutation is allowed only during data finalize",
    );
  }
  if (phase !== LIFECYCLE_EVENT_PHASES.FCM_CLEANUP && releaseLocks) {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
      "[lifecycleOperationStore] locks can be released only after cleanup",
    );
  }
}

export function createFirestoreLifecycleOperationStore({
  firestore,
  timestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  assertFirestore(firestore);
  if (typeof timestampFactory !== "function") {
    fail(
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[lifecycleOperationStore] timestampFactory is invalid",
    );
  }

  return Object.freeze({
    async completeEmployeeReinstatement({
      companyId,
      operationInput,
      readRequests = [],
      mutation,
    } = {}) {
      const timestamp = timestampFactory();
      const operation = createEmployeeReinstatementOperationRecord({
        ...operationInput,
        timestamp,
      });
      const operationRef = firestore.doc(
        lifecycleOperationPath(companyId, operation.operationId),
      );
      const lockRef = firestore.doc(
        employeeLifecycleLockPath(companyId, operation.employeeId),
      );
      const headRef = firestore.doc(
        employeeLifecycleHeadPath(companyId, operation.employeeId),
      );
      const resolvedReadRequests = resolveReadRequests(readRequests);

      return firestore.runTransaction(async (transaction) => {
        assertTransaction(transaction);
        const operationSnapshot = await transaction.get(operationRef);
        if (operationSnapshot.exists) {
          return Object.freeze({
            created: false,
            operation: resolveExistingOperation(operationSnapshot, operation),
          });
        }

        const lockSnapshot = await transaction.get(lockRef);
        if (lockSnapshot.exists) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE,
            "[lifecycleOperationStore] target already has an active operation",
          );
        }
        const headSnapshot = await transaction.get(headRef);
        const currentHead = headSnapshot.exists ? headSnapshot.data() : null;
        const reads = await readRequestedSnapshots(
          transaction,
          resolvedReadRequests,
        );
        const event = createLifecycleEventRecord({
          phase: LIFECYCLE_EVENT_PHASES.EMPLOYEE_REINSTATEMENT,
          attempt: operation.attemptCount,
          outcome: LIFECYCLE_EVENT_OUTCOMES.SUCCEEDED,
          timestamp,
        });
        const lock = createLifecycleLockRecord({
          operationId: operation.operationId,
          operationType: operation.operationType,
          timestamp,
        });
        const head = createNextEmployeeLifecycleHead({
          currentHead,
          operationId: operation.operationId,
          operationType: operation.operationType,
          timestamp,
        });

        applySynchronousMutation(mutation, {
          write: createWriteOnlyTransaction(transaction),
          operation,
          timestamp,
          reads,
          currentHead,
          head,
        });
        transaction.create(operationRef, operation);
        transaction.create(
          firestore.doc(
            lifecycleEventPath(
              companyId,
              operation.operationId,
              event.phase,
              event.attempt,
            ),
          ),
          event,
        );
        transaction.create(lockRef, lock);
        transaction.set(headRef, head);
        transaction.delete(lockRef);

        return Object.freeze({ created: true, operation });
      });
    },

    async completeEmployeeOnlyRetirement({
      companyId,
      operationInput,
      readRequests = [],
      mutation,
    } = {}) {
      const timestamp = timestampFactory();
      const operation = createEmployeeOnlyRetirementOperationRecord({
        ...operationInput,
        timestamp,
      });
      const operationRef = firestore.doc(
        lifecycleOperationPath(companyId, operation.operationId),
      );
      const lockRef = firestore.doc(
        employeeLifecycleLockPath(companyId, operation.employeeId),
      );
      const headRef = firestore.doc(
        employeeLifecycleHeadPath(companyId, operation.employeeId),
      );
      const resolvedReadRequests = resolveReadRequests(readRequests);

      return firestore.runTransaction(async (transaction) => {
        assertTransaction(transaction);
        const operationSnapshot = await transaction.get(operationRef);
        if (operationSnapshot.exists) {
          return Object.freeze({
            created: false,
            operation: resolveExistingOperation(operationSnapshot, operation),
          });
        }

        const lockSnapshot = await transaction.get(lockRef);
        if (lockSnapshot.exists) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE,
            "[lifecycleOperationStore] target already has an active operation",
          );
        }
        const headSnapshot = await transaction.get(headRef);
        const currentHead = headSnapshot.exists ? headSnapshot.data() : null;
        const reads = await readRequestedSnapshots(
          transaction,
          resolvedReadRequests,
        );
        const event = createLifecycleEventRecord({
          phase: LIFECYCLE_EVENT_PHASES.EMPLOYEE_RETIREMENT,
          attempt: operation.attemptCount,
          outcome: LIFECYCLE_EVENT_OUTCOMES.SUCCEEDED,
          timestamp,
        });
        const lock = createLifecycleLockRecord({
          operationId: operation.operationId,
          operationType: operation.operationType,
          timestamp,
        });
        const head = createNextEmployeeLifecycleHead({
          currentHead,
          operationId: operation.operationId,
          operationType: operation.operationType,
          timestamp,
        });

        applySynchronousMutation(mutation, {
          write: createWriteOnlyTransaction(transaction),
          operation,
          timestamp,
          reads,
          currentHead,
          head,
        });
        transaction.create(operationRef, operation);
        transaction.create(
          firestore.doc(
            lifecycleEventPath(
              companyId,
              operation.operationId,
              event.phase,
              event.attempt,
            ),
          ),
          event,
        );
        transaction.create(lockRef, lock);
        transaction.set(headRef, head);
        transaction.delete(lockRef);

        return Object.freeze({ created: true, operation });
      });
    },

    async beginRegisteredUserDeletion({
      companyId,
      operationInput,
      readRequests = [],
      mutation,
    } = {}) {
      const timestamp = timestampFactory();
      const initial = createRegisteredUserDeletionOperationRecord({
        ...operationInput,
        timestamp,
      });
      const operationRef = firestore.doc(
        lifecycleOperationPath(companyId, initial.operationId),
      );
      const lockRefs = operationLockPaths(companyId, initial).map((path) =>
        firestore.doc(path),
      );
      const resolvedReadRequests = resolveReadRequests(readRequests);

      return firestore.runTransaction(async (transaction) => {
        assertTransaction(transaction);
        const operationSnapshot = await transaction.get(operationRef);
        if (operationSnapshot.exists) {
          return Object.freeze({
            created: false,
            operation: resolveExistingOperation(operationSnapshot, initial),
          });
        }

        const lockSnapshots = [];
        for (const lockRef of lockRefs) {
          lockSnapshots.push(await transaction.get(lockRef));
        }
        if (lockSnapshots.some((snapshot) => snapshot.exists)) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE,
            "[lifecycleOperationStore] target already has an active operation",
          );
        }
        const reads = await readRequestedSnapshots(
          transaction,
          resolvedReadRequests,
        );

        const operation = createNextOperation({
          current: initial,
          nextState: initial.state,
          phase: "access-revoke",
          outcome: LIFECYCLE_EVENT_OUTCOMES.SUCCEEDED,
          errorCode: null,
          timestamp,
        });
        const event = createLifecycleEventRecord({
          phase: "access-revoke",
          attempt: operation.attemptCount,
          outcome: LIFECYCLE_EVENT_OUTCOMES.SUCCEEDED,
          timestamp,
        });
        const lock = createLifecycleLockRecord({
          operationId: operation.operationId,
          operationType: operation.operationType,
          timestamp,
        });

        applySynchronousMutation(mutation, {
          write: createWriteOnlyTransaction(transaction),
          operation,
          timestamp,
          reads,
        });
        transaction.create(operationRef, operation);
        transaction.create(
          firestore.doc(
            lifecycleEventPath(
              companyId,
              operation.operationId,
              event.phase,
              event.attempt,
            ),
          ),
          event,
        );
        for (const lockRef of lockRefs) transaction.create(lockRef, lock);

        return Object.freeze({ created: true, operation });
      });
    },

    async advance({
      companyId,
      operationId,
      requestFingerprint,
      expectedStates,
      nextState,
      phase,
      outcome = LIFECYCLE_EVENT_OUTCOMES.SUCCEEDED,
      errorCode = null,
      authDisposition,
      cleanupState,
      releaseLocks = false,
      readRequests = [],
      mutation,
    } = {}) {
      if (!Array.isArray(expectedStates) || expectedStates.length === 0) {
        fail(
          LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
          "[lifecycleOperationStore] expectedStates is invalid",
        );
      }
      const operationRef = firestore.doc(
        lifecycleOperationPath(companyId, operationId),
      );
      const timestamp = timestampFactory();
      const resolvedReadRequests = resolveReadRequests(readRequests);

      return firestore.runTransaction(async (transaction) => {
        assertTransaction(transaction);
        const operationSnapshot = await transaction.get(operationRef);
        if (!operationSnapshot.exists) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_NOT_FOUND,
            "[lifecycleOperationStore] operation was not found",
          );
        }
        const current = assertLifecycleOperationRecord(
          operationSnapshot.data(),
        );
        if (current.requestFingerprint !== requestFingerprint) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_ID_CONFLICT,
            "[lifecycleOperationStore] request fingerprint does not match",
          );
        }
        if (!expectedStates.includes(current.state)) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
            "[lifecycleOperationStore] operation state cannot advance",
          );
        }

        assertRegisteredDeletionTransition({
          current,
          nextState,
          phase,
          outcome,
          authDisposition,
          cleanupState,
          releaseLocks,
          mutation,
        });

        const next = createNextOperation({
          current,
          nextState,
          authDisposition,
          cleanupState,
          phase,
          outcome,
          errorCode,
          timestamp,
        });
        const event = createLifecycleEventRecord({
          phase,
          attempt: next.attemptCount,
          outcome,
          errorCode,
          timestamp,
        });
        const eventRef = firestore.doc(
          lifecycleEventPath(
            companyId,
            operationId,
            event.phase,
            event.attempt,
          ),
        );
        const eventSnapshot = await transaction.get(eventRef);
        if (eventSnapshot.exists) {
          fail(
            LIFECYCLE_OPERATION_STORE_ERROR_CODES.EVENT_ALREADY_EXISTS,
            "[lifecycleOperationStore] event already exists",
          );
        }

        const lockRefs = operationLockPaths(companyId, current).map((path) =>
          firestore.doc(path),
        );
        if (releaseLocks) {
          for (const lockRef of lockRefs) {
            assertLockOwnership(await transaction.get(lockRef), current);
          }
        }
        const reads = await readRequestedSnapshots(
          transaction,
          resolvedReadRequests,
        );

        applySynchronousMutation(mutation, {
          write: createWriteOnlyTransaction(transaction),
          current,
          operation: next,
          timestamp,
          reads,
        });
        transaction.set(operationRef, next);
        transaction.create(eventRef, event);
        if (releaseLocks) {
          for (const lockRef of lockRefs) transaction.delete(lockRef);
        }
        return next;
      });
    },
  });
}

export function registeredDeletionFailureState(operation) {
  assertLifecycleOperationRecord(operation);
  if (operation.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED) {
    return Object.freeze({
      nextState: LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
      cleanupState: LIFECYCLE_CLEANUP_STATES.FAILED,
    });
  }
  return Object.freeze({
    nextState: LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE,
    cleanupState: operation.cleanupState,
  });
}
