/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/registeredUserDeletionEngine.js
 * @description UWB-07A/Bで共有する本登録User削除phase engineです。
 * Firestore transactionとAuth/FCM外部作用を分離し、同一operationを再開します。
 *****************************************************************************/
import {
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_CLEANUP_STATES,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_EVENT_OUTCOMES,
  LIFECYCLE_EVENT_PHASES,
  LIFECYCLE_OPERATION_STATES,
  LifecycleOperationSchemaError,
} from "./lifecycleOperationSchema.js";
import {
  LIFECYCLE_OPERATION_STORE_ERROR_CODES,
  LifecycleOperationStoreError,
  registeredDeletionFailureState,
} from "./lifecycleOperationStore.js";

const ALLOWED_DOMAIN_CODES = new Set(
  Object.values(LIFECYCLE_DOMAIN_ERROR_CODES),
);

export const REGISTERED_USER_DELETION_ENGINE_ERROR_CODES = Object.freeze({
  DEPENDENCY_INVALID: "dependency-invalid",
  OPERATION_STATE_INVALID: "operation-state-invalid",
  AUTH_DISPOSITION_INVALID: "auth-disposition-invalid",
  PHASE_FAILED: "phase-failed",
  FAILURE_RECORDING_FAILED: "failure-recording-failed",
});

export class RegisteredUserDeletionEngineError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "RegisteredUserDeletionEngineError";
    this.code = code;
    this.phase = options.phase ?? null;
    this.domainCode = options.domainCode ?? null;
    this.failureRecorded = options.failureRecorded ?? false;
    this.recordingError = options.recordingError ?? null;
  }
}

function fail(code, message, options = {}) {
  throw new RegisteredUserDeletionEngineError(code, message, options);
}

function assertDependencies({ store, authGateway, cleanupFcm, mutations, reads }) {
  if (
    !store ||
    typeof store.beginRegisteredUserDeletion !== "function" ||
    typeof store.advance !== "function" ||
    !authGateway ||
    typeof authGateway.disableAndVerify !== "function" ||
    typeof authGateway.revalidateAndDelete !== "function" ||
    typeof cleanupFcm !== "function" ||
    !mutations ||
    typeof mutations.accessRevoke !== "function" ||
    typeof mutations.finalizeData !== "function" ||
    !reads ||
    typeof reads !== "object" ||
    Array.isArray(reads) ||
    (reads.accessRevoke !== undefined &&
      !Array.isArray(reads.accessRevoke)) ||
    (reads.finalizeData !== undefined && !Array.isArray(reads.finalizeData))
  ) {
    fail(
      REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.DEPENDENCY_INVALID,
      "[registeredUserDeletionEngine] dependencies are invalid",
    );
  }
}

function resolveDomainCode(error) {
  if (ALLOWED_DOMAIN_CODES.has(error?.domainCode)) return error.domainCode;
  if (error instanceof LifecycleOperationStoreError) {
    if (
      error.code ===
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_ID_CONFLICT
    ) {
      return LIFECYCLE_DOMAIN_ERROR_CODES.OPERATION_ID_CONFLICT;
    }
    if (
      error.code ===
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE
    ) {
      return LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_OPERATION_ACTIVE;
    }
    return LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL;
  }
  if (
    error instanceof LifecycleOperationSchemaError ||
    error instanceof RegisteredUserDeletionEngineError
  ) {
    return LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL;
  }
  return LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE;
}

async function recordPhaseFailure({
  store,
  companyId,
  operation,
  phase,
  error,
}) {
  const domainCode = resolveDomainCode(error);
  const failureState = registeredDeletionFailureState(operation);
  try {
    const recorded = await store.advance({
      companyId,
      operationId: operation.operationId,
      requestFingerprint: operation.requestFingerprint,
      expectedStates: [operation.state],
      nextState: failureState.nextState,
      phase,
      outcome: LIFECYCLE_EVENT_OUTCOMES.FAILED_RETRYABLE,
      errorCode: domainCode,
      cleanupState: failureState.cleanupState,
    });
    return { recorded, domainCode };
  } catch (recordingError) {
    fail(
      REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.FAILURE_RECORDING_FAILED,
      "[registeredUserDeletionEngine] phase failed and failure state could not be recorded",
      {
        cause: error,
        phase,
        domainCode,
        recordingError,
      },
    );
  }
}

async function runRecoverablePhase({
  store,
  companyId,
  operation,
  phase,
  action,
}) {
  try {
    return await action();
  } catch (error) {
    const failure = await recordPhaseFailure({
      store,
      companyId,
      operation,
      phase,
      error,
    });
    fail(
      REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.PHASE_FAILED,
      "[registeredUserDeletionEngine] phase failed",
      {
        cause: error,
        phase,
        domainCode: failure.domainCode,
        failureRecorded: true,
      },
    );
  }
}

function failedAt(operation, phase) {
  return (
    operation.state === LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE &&
    operation.lastErrorPhase === phase
  );
}

function assertKnownResumeState(operation) {
  if (operation.state !== LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE) return;
  if (
    ![
      LIFECYCLE_EVENT_PHASES.AUTH_DISABLE,
      LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT,
      LIFECYCLE_EVENT_PHASES.AUTH_DELETE,
      LIFECYCLE_EVENT_PHASES.DATA_FINALIZE,
    ].includes(operation.lastErrorPhase)
  ) {
    fail(
      REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.OPERATION_STATE_INVALID,
      "[registeredUserDeletionEngine] failed operation has no supported resume phase",
    );
  }
}

/**
 * 同一operationを保存済みphaseから再開します。
 * Auth gatewayとFCM cleanupはFirestore transaction外でだけ呼び出します。
 */
export async function runRegisteredUserDeletion({
  store,
  authGateway,
  cleanupFcm,
  mutations,
  reads = {},
  companyId,
  operationInput,
} = {}) {
  assertDependencies({ store, authGateway, cleanupFcm, mutations, reads });

  const begin = await store.beginRegisteredUserDeletion({
    companyId,
    operationInput,
    readRequests: reads.accessRevoke,
    mutation: mutations.accessRevoke,
  });
  let operation = begin.operation;
  assertKnownResumeState(operation);

  if (operation.state === LIFECYCLE_OPERATION_STATES.COMPLETED) {
    return Object.freeze({ status: "completed", operation });
  }

  if (
    operation.state === LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING ||
    failedAt(operation, LIFECYCLE_EVENT_PHASES.AUTH_DISABLE)
  ) {
    operation = await runRecoverablePhase({
      store,
      companyId,
      operation,
      phase: LIFECYCLE_EVENT_PHASES.AUTH_DISABLE,
      action: async () => {
        await authGateway.disableAndVerify({
          targetUserUid: operation.targetUserUid,
          operation,
        });
        return store.advance({
          companyId,
          operationId: operation.operationId,
          requestFingerprint: operation.requestFingerprint,
          expectedStates: [operation.state],
          nextState: LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED,
          phase: LIFECYCLE_EVENT_PHASES.AUTH_DISABLE,
        });
      },
    });
  }

  if (
    operation.state === LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED ||
    failedAt(operation, LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT)
  ) {
    operation = await runRecoverablePhase({
      store,
      companyId,
      operation,
      phase: LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT,
      action: () =>
        store.advance({
          companyId,
          operationId: operation.operationId,
          requestFingerprint: operation.requestFingerprint,
          expectedStates: [operation.state],
          nextState: LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT,
          phase: LIFECYCLE_EVENT_PHASES.AUTH_DELETE_INTENT,
        }),
    });
  }

  if (
    (operation.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
      operation.authDisposition === LIFECYCLE_AUTH_DISPOSITIONS.PRESENT) ||
    failedAt(operation, LIFECYCLE_EVENT_PHASES.AUTH_DELETE)
  ) {
    operation = await runRecoverablePhase({
      store,
      companyId,
      operation,
      phase: LIFECYCLE_EVENT_PHASES.AUTH_DELETE,
      action: async () => {
        const authDisposition = await authGateway.revalidateAndDelete({
          targetUserUid: operation.targetUserUid,
          operation,
        });
        if (
          authDisposition !== LIFECYCLE_AUTH_DISPOSITIONS.DELETED &&
          authDisposition !== LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT
        ) {
          fail(
            REGISTERED_USER_DELETION_ENGINE_ERROR_CODES
              .AUTH_DISPOSITION_INVALID,
            "[registeredUserDeletionEngine] Auth disposition is invalid",
          );
        }
        return store.advance({
          companyId,
          operationId: operation.operationId,
          requestFingerprint: operation.requestFingerprint,
          expectedStates: [operation.state],
          nextState: LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT,
          phase: LIFECYCLE_EVENT_PHASES.AUTH_DELETE,
          authDisposition,
        });
      },
    });
  }

  if (
    (operation.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
      [
        LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
        LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
      ].includes(operation.authDisposition)) ||
    failedAt(operation, LIFECYCLE_EVENT_PHASES.DATA_FINALIZE)
  ) {
    operation = await runRecoverablePhase({
      store,
      companyId,
      operation,
      phase: LIFECYCLE_EVENT_PHASES.DATA_FINALIZE,
      action: () =>
        store.advance({
          companyId,
          operationId: operation.operationId,
          requestFingerprint: operation.requestFingerprint,
          expectedStates: [operation.state],
          nextState: LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
          phase: LIFECYCLE_EVENT_PHASES.DATA_FINALIZE,
          readRequests: reads.finalizeData,
          mutation: mutations.finalizeData,
        }),
    });
  }

  if (operation.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED) {
    try {
      await cleanupFcm({
        targetUserUid: operation.targetUserUid,
        operation,
      });
    } catch (error) {
      const failure = await recordPhaseFailure({
        store,
        companyId,
        operation,
        phase: LIFECYCLE_EVENT_PHASES.FCM_CLEANUP,
        error,
      });
      return Object.freeze({
        status: "completed-cleanup-pending",
        operation: failure.recorded,
      });
    }

    operation = await runRecoverablePhase({
      store,
      companyId,
      operation,
      phase: LIFECYCLE_EVENT_PHASES.FCM_CLEANUP,
      action: () =>
        store.advance({
          companyId,
          operationId: operation.operationId,
          requestFingerprint: operation.requestFingerprint,
          expectedStates: [operation.state],
          nextState: LIFECYCLE_OPERATION_STATES.COMPLETED,
          phase: LIFECYCLE_EVENT_PHASES.FCM_CLEANUP,
          cleanupState: LIFECYCLE_CLEANUP_STATES.COMPLETED,
          releaseLocks: true,
        }),
    });
  }

  if (operation.state !== LIFECYCLE_OPERATION_STATES.COMPLETED) {
    fail(
      REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.OPERATION_STATE_INVALID,
      "[registeredUserDeletionEngine] operation did not reach a supported state",
    );
  }
  return Object.freeze({ status: "completed", operation });
}
