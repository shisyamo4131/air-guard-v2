import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEmployeeLifecycleHeadRecord,
  assertLifecycleEventRecord,
  assertLifecycleOperationRecord,
  createEmployeeOnlyRetirementOperationRecord,
  createLifecycleEventRecord,
  createLifecycleRequestFingerprint,
  createNextEmployeeLifecycleHead,
  createRegisteredUserDeletionOperationRecord,
  employeeLifecycleHeadPath,
  employeeLifecycleLockPath,
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_CLEANUP_STATES,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_EVENT_OUTCOMES,
  LIFECYCLE_EVENT_PHASES,
  LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
  LifecycleOperationSchemaError,
  lifecycleEventPath,
  lifecycleOperationPath,
  userLifecycleLockPath,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";
import {
  createFirestoreLifecycleOperationStore,
  LIFECYCLE_OPERATION_STORE_ERROR_CODES,
  LifecycleOperationStoreError,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationStore.js";
import {
  REGISTERED_USER_DELETION_ENGINE_ERROR_CODES,
  RegisteredUserDeletionEngineError,
  runRegisteredUserDeletion,
} from "../../functions/modules/auth/lifecycle/registeredUserDeletionEngine.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const TARGET_UID = "target-a";
const EMPLOYEE_ID = "employee-a";
const OPERATION_ID = "018f0f5e-7b4a-4a1f-8f35-cd5658b762d1";
const OTHER_OPERATION_ID = "018f0f5e-7b4a-4a1f-9f35-cd5658b762d2";
const TARGET_PATH = `Companies/${COMPANY_ID}/Users/${TARGET_UID}`;
const RESERVATION_PATH = "UserEmailReservations/reservation-a";
const TIMESTAMP = Object.freeze({ kind: "server-timestamp" });

function standaloneNormalizedInput(overrides = {}) {
  return {
    targetUserId: TARGET_UID,
    reason: "利用終了",
    ...overrides,
  };
}

function standaloneOperationInput(overrides = {}) {
  const normalizedInput = standaloneNormalizedInput();
  return {
    operationId: OPERATION_ID,
    operationType:
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    actorUid: ACTOR_UID,
    actorDisplayName: "管理者",
    targetUserUid: TARGET_UID,
    targetDisplayName: "対象者",
    offboardingReason: normalizedInput.reason,
    requestFingerprint: createLifecycleRequestFingerprint({
      actorUid: ACTOR_UID,
      operationType:
        LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
      normalizedInput,
    }),
    ...overrides,
  };
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createFakeFirestore({ initial = {}, failRuns = [] } = {}) {
  const documents = new Map(
    Object.entries(initial).map(([path, data]) => [path, clone(data)]),
  );
  const calls = [];
  let transactionRun = 0;
  let inTransaction = false;

  const firestore = {
    doc(path) {
      return Object.freeze({ path });
    },
    async runTransaction(callback) {
      transactionRun += 1;
      const run = transactionRun;
      calls.push({ method: "runTransaction", run });
      const writes = [];
      const transaction = {
        async get(reference) {
          calls.push({ method: "get", path: reference.path, run });
          const exists = documents.has(reference.path);
          return {
            exists,
            data: () => clone(documents.get(reference.path)),
          };
        },
        create(reference, data) {
          calls.push({ method: "create", path: reference.path, run });
          writes.push({ method: "create", path: reference.path, data: clone(data) });
        },
        set(reference, data) {
          calls.push({ method: "set", path: reference.path, run });
          writes.push({ method: "set", path: reference.path, data: clone(data) });
        },
        update(reference, data) {
          calls.push({ method: "update", path: reference.path, run });
          writes.push({ method: "update", path: reference.path, data: clone(data) });
        },
        delete(reference) {
          calls.push({ method: "delete", path: reference.path, run });
          writes.push({ method: "delete", path: reference.path });
        },
      };

      inTransaction = true;
      let result;
      try {
        result = await callback(transaction);
      } finally {
        inTransaction = false;
      }
      if (failRuns.includes(run)) {
        throw Object.assign(new Error(`synthetic transaction ${run} failure`), {
          domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE,
        });
      }
      for (const write of writes) {
        if (write.method === "create") {
          if (documents.has(write.path)) throw new Error("already exists");
          documents.set(write.path, write.data);
        } else if (write.method === "set") {
          documents.set(write.path, write.data);
        } else if (write.method === "update") {
          if (!documents.has(write.path)) throw new Error("not found");
          documents.set(write.path, {
            ...documents.get(write.path),
            ...write.data,
          });
        } else {
          documents.delete(write.path);
        }
      }
      return result;
    },
  };

  return {
    firestore,
    documents,
    calls,
    get inTransaction() {
      return inTransaction;
    },
  };
}

function createStore(fake) {
  return createFirestoreLifecycleOperationStore({
    firestore: fake.firestore,
    timestampFactory: () => TIMESTAMP,
  });
}

function assertSchemaError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof LifecycleOperationSchemaError);
    assert.equal(error.code, code);
    return true;
  });
}

test("lifecycle schema constants and paths are stable and server-only", () => {
  for (const value of [
    LIFECYCLE_OPERATION_TYPES,
    LIFECYCLE_OPERATION_STATES,
    LIFECYCLE_AUTH_DISPOSITIONS,
    LIFECYCLE_CLEANUP_STATES,
    LIFECYCLE_EVENT_PHASES,
    LIFECYCLE_EVENT_OUTCOMES,
    LIFECYCLE_DOMAIN_ERROR_CODES,
  ]) {
    assert.equal(Object.isFrozen(value), true);
  }
  assert.equal(
    lifecycleOperationPath(COMPANY_ID, OPERATION_ID),
    `Companies/${COMPANY_ID}/LifecycleOperations/${OPERATION_ID}`,
  );
  assert.equal(
    lifecycleEventPath(
      COMPANY_ID,
      OPERATION_ID,
      LIFECYCLE_EVENT_PHASES.AUTH_DELETE,
      3,
    ),
    `Companies/${COMPANY_ID}/LifecycleOperations/${OPERATION_ID}/Events/auth-delete-3`,
  );
  assert.equal(
    userLifecycleLockPath(COMPANY_ID, TARGET_UID),
    `Companies/${COMPANY_ID}/UserLifecycleLocks/${TARGET_UID}`,
  );
  assert.equal(
    employeeLifecycleLockPath(COMPANY_ID, EMPLOYEE_ID),
    `Companies/${COMPANY_ID}/EmployeeLifecycleLocks/${EMPLOYEE_ID}`,
  );
  assert.equal(
    employeeLifecycleHeadPath(COMPANY_ID, EMPLOYEE_ID),
    `Companies/${COMPANY_ID}/EmployeeLifecycleHeads/${EMPLOYEE_ID}`,
  );
});

test("request fingerprint is ordered, stable, and excludes operation ID", () => {
  const first = createLifecycleRequestFingerprint({
    actorUid: ACTOR_UID,
    operationType:
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    normalizedInput: standaloneNormalizedInput(),
  });
  const second = createLifecycleRequestFingerprint({
    actorUid: ACTOR_UID,
    operationType:
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    normalizedInput: { reason: "利用終了", targetUserId: TARGET_UID },
  });
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(
    first,
    createLifecycleRequestFingerprint({
      actorUid: "actor-b",
      operationType:
        LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
      normalizedInput: standaloneNormalizedInput(),
    }),
  );
  assertSchemaError(
    () =>
      createLifecycleRequestFingerprint({
        actorUid: ACTOR_UID,
        operationType:
          LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
        normalizedInput: { ...standaloneNormalizedInput(), companyId: COMPANY_ID },
      }),
    LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.FIELD_SET_INVALID,
  );
});

test("registered deletion record has the exact privacy-minimized schema", () => {
  const operation = createRegisteredUserDeletionOperationRecord({
    ...standaloneOperationInput(),
    timestamp: TIMESTAMP,
  });
  assert.equal(assertLifecycleOperationRecord(operation), operation);
  assert.equal(operation.schemaVersion, 1);
  assert.equal(operation.state, "access-revoke-pending");
  assert.equal(operation.authDisposition, "present");
  assert.equal(operation.cleanupState, "pending");
  assert.equal(operation.employeeId, null);
  for (const forbidden of [
    "email",
    "emailHash",
    "roles",
    "claims",
    "fcmToken",
    "userSnapshot",
  ]) {
    assert.equal(Object.hasOwn(operation, forbidden), false);
  }
  assertSchemaError(
    () => assertLifecycleOperationRecord({ ...operation, email: "x@example.test" }),
    LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.FIELD_SET_INVALID,
  );
});

test("registered Employee retirement record acquires both target locks", async () => {
  const normalizedInput = {
    employeeId: EMPLOYEE_ID,
    terminationDate: "2026-08-24",
    reasonOfTermination: "契約満了",
  };
  const fake = createFakeFirestore({ initial: { [TARGET_PATH]: {} } });
  const result = await createStore(fake).beginRegisteredUserDeletion({
    companyId: COMPANY_ID,
    operationInput: {
      operationId: OPERATION_ID,
      operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
      actorUid: ACTOR_UID,
      actorDisplayName: "担当者",
      employeeId: EMPLOYEE_ID,
      targetUserUid: TARGET_UID,
      targetDisplayName: "退職者",
      terminationDate: normalizedInput.terminationDate,
      reasonOfTermination: normalizedInput.reasonOfTermination,
      requestFingerprint: createLifecycleRequestFingerprint({
        actorUid: ACTOR_UID,
        operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
        normalizedInput,
      }),
    },
    mutation: () => {},
  });
  assert.equal(result.operation.employeeId, EMPLOYEE_ID);
  assert.ok(fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)));
  assert.ok(
    fake.documents.has(employeeLifecycleLockPath(COMPANY_ID, EMPLOYEE_ID)),
  );
});

test("Employee-only retirement completes operation, event, Employee update, and head atomically", async () => {
  const employeePath = `Companies/${COMPANY_ID}/Employees/${EMPLOYEE_ID}`;
  const headPath = employeeLifecycleHeadPath(COMPANY_ID, EMPLOYEE_ID);
  const fingerprint = createLifecycleRequestFingerprint({
    actorUid: ACTOR_UID,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    normalizedInput: {
      employeeId: EMPLOYEE_ID,
      terminationDate: "2026-08-24",
      reasonOfTermination: "契約満了",
    },
  });
  const input = {
    operationId: OPERATION_ID,
    actorUid: ACTOR_UID,
    actorDisplayName: "担当者",
    employeeId: EMPLOYEE_ID,
    terminationDate: "2026-08-24",
    reasonOfTermination: "契約満了",
    requestFingerprint: fingerprint,
  };
  const record = createEmployeeOnlyRetirementOperationRecord({
    ...input,
    timestamp: TIMESTAMP,
  });
  assert.equal(record.targetUserUid, null);
  assert.equal(record.authDisposition, LIFECYCLE_AUTH_DISPOSITIONS.NOT_APPLICABLE);
  assert.equal(record.cleanupState, LIFECYCLE_CLEANUP_STATES.NOT_APPLICABLE);
  assert.equal(record.state, LIFECYCLE_OPERATION_STATES.COMPLETED);

  const fake = createFakeFirestore({
    initial: { [employeePath]: { employmentStatus: "ACTIVE" } },
  });
  const result = await createStore(fake).completeEmployeeOnlyRetirement({
    companyId: COMPANY_ID,
    operationInput: input,
    readRequests: [
      { key: "employee", reference: fake.firestore.doc(employeePath) },
    ],
    mutation: ({ write, reads, head }) => {
      assert.equal(reads.employee.data().employmentStatus, "ACTIVE");
      assert.equal(head.revision, 1);
      write.update(fake.firestore.doc(employeePath), {
        employmentStatus: "RESIGNED",
      });
    },
  });

  assert.equal(result.created, true);
  assert.equal(result.operation.state, LIFECYCLE_OPERATION_STATES.COMPLETED);
  assert.equal(fake.documents.get(employeePath).employmentStatus, "RESIGNED");
  assert.equal(fake.documents.get(headPath).revision, 1);
  assert.equal(
    fake.documents.has(employeeLifecycleLockPath(COMPANY_ID, EMPLOYEE_ID)),
    false,
  );
  assert.ok(
    fake.documents.has(
      lifecycleEventPath(
        COMPANY_ID,
        OPERATION_ID,
        LIFECYCLE_EVENT_PHASES.EMPLOYEE_RETIREMENT,
        1,
      ),
    ),
  );
});

test("event outcome/error and Employee head revision fail closed", () => {
  const event = createLifecycleEventRecord({
    phase: LIFECYCLE_EVENT_PHASES.AUTH_DISABLE,
    attempt: 2,
    outcome: LIFECYCLE_EVENT_OUTCOMES.FAILED_RETRYABLE,
    errorCode: LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE,
    timestamp: TIMESTAMP,
  });
  assert.equal(assertLifecycleEventRecord(event), event);
  assertSchemaError(
    () =>
      assertLifecycleEventRecord({
        ...event,
        outcome: LIFECYCLE_EVENT_OUTCOMES.SUCCEEDED,
      }),
    LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.EVENT_SHAPE_INVALID,
  );

  const first = createNextEmployeeLifecycleHead({
    operationId: OPERATION_ID,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    timestamp: TIMESTAMP,
  });
  const second = createNextEmployeeLifecycleHead({
    currentHead: first,
    operationId: OTHER_OPERATION_ID,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT,
    timestamp: TIMESTAMP,
  });
  assert.equal(first.revision, 1);
  assert.equal(second.revision, 2);
  assert.equal(assertEmployeeLifecycleHeadRecord(second), second);
});

test("store begin atomically creates operation, event, locks, and access revoke", async () => {
  const fake = createFakeFirestore({ initial: { [TARGET_PATH]: { disabled: false } } });
  const store = createStore(fake);
  const result = await store.beginRegisteredUserDeletion({
    companyId: COMPANY_ID,
    operationInput: standaloneOperationInput(),
    readRequests: [
      { key: "targetUser", reference: fake.firestore.doc(TARGET_PATH) },
    ],
    mutation: ({ write, reads }) => {
      assert.equal(reads.targetUser.exists, true);
      assert.equal(reads.targetUser.data().disabled, false);
      write.update(fake.firestore.doc(TARGET_PATH), { disabled: true });
    },
  });

  assert.equal(result.created, true);
  assert.equal(result.operation.attemptCount, 1);
  assert.equal(fake.documents.get(TARGET_PATH).disabled, true);
  assert.ok(fake.documents.has(lifecycleOperationPath(COMPANY_ID, OPERATION_ID)));
  assert.ok(
    fake.documents.has(
      lifecycleEventPath(
        COMPANY_ID,
        OPERATION_ID,
        LIFECYCLE_EVENT_PHASES.ACCESS_REVOKE,
        1,
      ),
    ),
  );
  assert.ok(fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)));
  const transactionCalls = fake.calls.filter((call) => call.run === 1);
  const firstWrite = transactionCalls.findIndex((call) =>
    ["create", "set", "update", "delete"].includes(call.method),
  );
  assert.equal(
    transactionCalls
      .slice(firstWrite + 1)
      .some((call) => call.method === "get"),
    false,
  );
});

test("store begin is idempotent for one fingerprint and rejects conflict or active lock", async () => {
  const fake = createFakeFirestore({ initial: { [TARGET_PATH]: { disabled: false } } });
  const store = createStore(fake);
  let mutationCount = 0;
  const begin = () =>
    store.beginRegisteredUserDeletion({
      companyId: COMPANY_ID,
      operationInput: standaloneOperationInput(),
      mutation: () => {
        mutationCount += 1;
      },
    });
  assert.equal((await begin()).created, true);
  assert.equal((await begin()).created, false);
  assert.equal(mutationCount, 1);

  await assert.rejects(
    store.beginRegisteredUserDeletion({
      companyId: COMPANY_ID,
      operationInput: standaloneOperationInput({
        requestFingerprint: "a".repeat(64),
      }),
      mutation: () => {},
    }),
    (error) =>
      error instanceof LifecycleOperationStoreError &&
      error.code ===
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_ID_CONFLICT,
  );

  const other = createStore(
    createFakeFirestore({
      initial: {
        [TARGET_PATH]: { disabled: false },
        [userLifecycleLockPath(COMPANY_ID, TARGET_UID)]: {
          operationId: OTHER_OPERATION_ID,
          operationType:
            LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
          createdAt: TIMESTAMP,
        },
      },
    }),
  );
  await assert.rejects(
    other.beginRegisteredUserDeletion({
      companyId: COMPANY_ID,
      operationInput: standaloneOperationInput(),
      mutation: () => {},
    }),
    (error) =>
      error.code ===
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE,
  );
});

test("store rejects asynchronous mutation and failed transaction leaves no partial writes", async () => {
  const fake = createFakeFirestore({
    initial: { [TARGET_PATH]: { disabled: false } },
    failRuns: [1],
  });
  await assert.rejects(
    createStore(fake).beginRegisteredUserDeletion({
      companyId: COMPANY_ID,
      operationInput: standaloneOperationInput(),
      mutation: ({ write }) => {
        write.update(fake.firestore.doc(TARGET_PATH), { disabled: true });
      },
    }),
    /synthetic transaction 1 failure/,
  );
  assert.equal(fake.documents.get(TARGET_PATH).disabled, false);
  assert.equal(
    fake.documents.has(lifecycleOperationPath(COMPANY_ID, OPERATION_ID)),
    false,
  );

  const asyncFake = createFakeFirestore({ initial: { [TARGET_PATH]: {} } });
  await assert.rejects(
    createStore(asyncFake).beginRegisteredUserDeletion({
      companyId: COMPANY_ID,
      operationInput: standaloneOperationInput(),
      mutation: async () => {},
    }),
    (error) =>
      error.code === LIFECYCLE_OPERATION_STORE_ERROR_CODES.MUTATION_INVALID,
  );
});

test("store rejects skipped phases and premature lock release", async () => {
  const fake = createFakeFirestore({ initial: { [TARGET_PATH]: {} } });
  const store = createStore(fake);
  const begin = await store.beginRegisteredUserDeletion({
    companyId: COMPANY_ID,
    operationInput: standaloneOperationInput(),
    mutation: () => {},
  });
  await assert.rejects(
    store.advance({
      companyId: COMPANY_ID,
      operationId: OPERATION_ID,
      requestFingerprint: begin.operation.requestFingerprint,
      expectedStates: [LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING],
      nextState: LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
      phase: LIFECYCLE_EVENT_PHASES.DATA_FINALIZE,
      mutation: () => {},
      releaseLocks: true,
    }),
    (error) =>
      error.code ===
      LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_STATE_INVALID,
  );
  assert.equal(
    fake.documents.get(lifecycleOperationPath(COMPANY_ID, OPERATION_ID)).state,
    LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
  );
  assert.ok(fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)));
});

function createEngineContext({ failPhase = null, failRuns = [] } = {}) {
  const fake = createFakeFirestore({
    initial: {
      [TARGET_PATH]: { disabled: false },
      [RESERVATION_PATH]: { companyId: COMPANY_ID, userId: TARGET_UID },
    },
    failRuns,
  });
  const trace = [];
  const phaseError = (phase) =>
    Object.assign(new Error(`synthetic ${phase} failure`), {
      domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE,
    });
  const context = {
    fake,
    store: createStore(fake),
    authGateway: {
      async disableAndVerify() {
        assert.equal(fake.inTransaction, false);
        trace.push("auth-disable");
        if (failPhase === "auth-disable") throw phaseError("auth-disable");
      },
      async revalidateAndDelete() {
        assert.equal(fake.inTransaction, false);
        trace.push("auth-delete");
        if (failPhase === "auth-delete") throw phaseError("auth-delete");
        return LIFECYCLE_AUTH_DISPOSITIONS.DELETED;
      },
    },
    async cleanupFcm() {
      assert.equal(fake.inTransaction, false);
      trace.push("fcm-cleanup");
      if (failPhase === "fcm-cleanup") throw phaseError("fcm-cleanup");
    },
    mutations: {
      accessRevoke({ write, reads }) {
        trace.push("access-revoke");
        assert.equal(reads.targetUser.exists, true);
        write.update(fake.firestore.doc(TARGET_PATH), { disabled: true });
      },
      finalizeData({ write, reads }) {
        trace.push("data-finalize");
        assert.equal(reads.targetUser.exists, true);
        assert.equal(reads.emailReservation.exists, true);
        if (failPhase === "data-finalize") throw phaseError("data-finalize");
        write.delete(fake.firestore.doc(TARGET_PATH));
        write.delete(fake.firestore.doc(RESERVATION_PATH));
      },
    },
    reads: {
      accessRevoke: [
        { key: "targetUser", reference: fake.firestore.doc(TARGET_PATH) },
      ],
      finalizeData: [
        { key: "targetUser", reference: fake.firestore.doc(TARGET_PATH) },
        {
          key: "emailReservation",
          reference: fake.firestore.doc(RESERVATION_PATH),
        },
      ],
    },
    trace,
  };
  return context;
}

async function runEngine(context) {
  return runRegisteredUserDeletion({
    store: context.store,
    authGateway: context.authGateway,
    cleanupFcm: context.cleanupFcm,
    mutations: context.mutations,
    reads: context.reads,
    companyId: COMPANY_ID,
    operationInput: standaloneOperationInput(),
  });
}

test("registered deletion engine completes all phases outside Firestore transactions", async () => {
  const context = createEngineContext();
  const result = await runEngine(context);
  assert.equal(result.status, "completed");
  assert.equal(result.operation.state, LIFECYCLE_OPERATION_STATES.COMPLETED);
  assert.equal(result.operation.authDisposition, LIFECYCLE_AUTH_DISPOSITIONS.DELETED);
  assert.equal(result.operation.cleanupState, LIFECYCLE_CLEANUP_STATES.COMPLETED);
  assert.deepEqual(context.trace, [
    "access-revoke",
    "auth-disable",
    "auth-delete",
    "data-finalize",
    "fcm-cleanup",
  ]);
  assert.equal(context.fake.documents.has(TARGET_PATH), false);
  assert.equal(context.fake.documents.has(RESERVATION_PATH), false);
  assert.equal(
    context.fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)),
    false,
  );
  assert.equal(result.operation.attemptCount, 6);
});

for (const phase of ["auth-disable", "auth-delete", "data-finalize"]) {
  test(`registered deletion records ${phase} failure and resumes the same operation`, async () => {
    const context = createEngineContext({ failPhase: phase });
    await assert.rejects(
      runEngine(context),
      (error) =>
        error instanceof RegisteredUserDeletionEngineError &&
        error.code === REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.PHASE_FAILED &&
        error.phase === phase &&
        error.failureRecorded === true,
    );

    const operationPath = lifecycleOperationPath(COMPANY_ID, OPERATION_ID);
    const failed = context.fake.documents.get(operationPath);
    assert.equal(failed.state, LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE);
    assert.equal(failed.lastErrorPhase, phase);
    assert.ok(
      context.fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)),
    );

    context.authGateway.disableAndVerify = async () => {};
    context.authGateway.revalidateAndDelete = async () =>
      LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT;
    context.mutations.finalizeData = ({ write }) => {
      write.delete(context.fake.firestore.doc(TARGET_PATH));
      write.delete(context.fake.firestore.doc(RESERVATION_PATH));
    };
    const resumed = await runEngine(context);
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.operation.state, LIFECYCLE_OPERATION_STATES.COMPLETED);
  });
}

test("FCM cleanup failure keeps core deletion and lock for later reconcile", async () => {
  const context = createEngineContext({ failPhase: "fcm-cleanup" });
  const pending = await runEngine(context);
  assert.equal(pending.status, "completed-cleanup-pending");
  assert.equal(pending.operation.state, LIFECYCLE_OPERATION_STATES.DATA_FINALIZED);
  assert.equal(pending.operation.cleanupState, LIFECYCLE_CLEANUP_STATES.FAILED);
  assert.equal(context.fake.documents.has(TARGET_PATH), false);
  assert.equal(context.fake.documents.has(RESERVATION_PATH), false);
  assert.ok(
    context.fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)),
  );

  context.cleanupFcm = async () => {};
  const completed = await runEngine(context);
  assert.equal(completed.status, "completed");
  assert.equal(completed.operation.cleanupState, LIFECYCLE_CLEANUP_STATES.COMPLETED);
  assert.equal(
    context.fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)),
    false,
  );
});

test("invalid Auth disposition is recorded as an internal invariant failure", async () => {
  const context = createEngineContext();
  context.authGateway.revalidateAndDelete = async () => "unknown";
  await assert.rejects(
    runEngine(context),
    (error) => {
      assert.equal(error.phase, LIFECYCLE_EVENT_PHASES.AUTH_DELETE);
      assert.equal(error.domainCode, LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL);
      return true;
    },
  );
  const operation = context.fake.documents.get(
    lifecycleOperationPath(COMPANY_ID, OPERATION_ID),
  );
  assert.equal(operation.lastErrorCode, LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL);
});

test("phase commit failure is recorded without hiding the original failure", async () => {
  const context = createEngineContext({ failRuns: [2] });
  await assert.rejects(
    runEngine(context),
    (error) => {
      assert.equal(error.code, REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.PHASE_FAILED);
      assert.equal(error.phase, LIFECYCLE_EVENT_PHASES.AUTH_DISABLE);
      assert.match(error.cause.message, /transaction 2 failure/);
      return true;
    },
  );
  const operation = context.fake.documents.get(
    lifecycleOperationPath(COMPANY_ID, OPERATION_ID),
  );
  assert.equal(operation.state, LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE);
  assert.equal(operation.lastErrorPhase, LIFECYCLE_EVENT_PHASES.AUTH_DISABLE);
});

test("failure recording failure preserves both errors and the durable prior state", async () => {
  const context = createEngineContext({ failRuns: [2, 3] });
  await assert.rejects(
    runEngine(context),
    (error) => {
      assert.equal(
        error.code,
        REGISTERED_USER_DELETION_ENGINE_ERROR_CODES.FAILURE_RECORDING_FAILED,
      );
      assert.equal(error.phase, LIFECYCLE_EVENT_PHASES.AUTH_DISABLE);
      assert.match(error.cause.message, /transaction 2 failure/);
      assert.match(error.recordingError.message, /transaction 3 failure/);
      return true;
    },
  );
  const operation = context.fake.documents.get(
    lifecycleOperationPath(COMPANY_ID, OPERATION_ID),
  );
  assert.equal(
    operation.state,
    LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
  );
  assert.ok(
    context.fake.documents.has(userLifecycleLockPath(COMPANY_ID, TARGET_UID)),
  );
});
