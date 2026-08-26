import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRegisteredUserDeletionOperationRecord,
  LIFECYCLE_OPERATION_TYPES,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";
import { reconcileLifecycleOperations } from "../../functions/modules/auth/lifecycle/reconcileLifecycleOperations.js";

const firestoreIndexes = JSON.parse(
  readFileSync(new URL("../../firestore.indexes.json", import.meta.url), "utf8"),
);

const timestamp = Object.freeze({ serverTimestamp: true });

function operation({ operationType, operationId, targetUserUid, employeeId }) {
  return createRegisteredUserDeletionOperationRecord({
    operationId,
    operationType,
    actorUid: "actor-a",
    actorDisplayName: "管理者",
    employeeId,
    targetUserUid,
    targetDisplayName: "対象者",
    terminationDate:
      operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? "2026-08-20"
        : null,
    reasonOfTermination:
      operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? "本人都合"
        : null,
    offboardingReason:
      operationType ===
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
        ? "利用終了"
        : null,
    requestFingerprint: "a".repeat(64),
    timestamp,
  });
}

function documentSnapshot(data, companyId = "company-a") {
  return {
    data: () => data,
    ref: {
      parent: {
        id: "LifecycleOperations",
        parent: {
          id: companyId,
          parent: { id: "Companies" },
        },
      },
    },
  };
}

function firestoreWith(documents) {
  const trace = [];
  const query = {
    where(field, operator, values) {
      trace.push(["where", field, operator, values]);
      return this;
    },
    limit(value) {
      trace.push(["limit", value]);
      return this;
    },
    async get() {
      return { size: documents.length, docs: documents };
    },
  };
  return {
    trace,
    collectionGroup(name) {
      trace.push(["collectionGroup", name]);
      return query;
    },
  };
}

test("reconciler state query has an explicit collection-group index", () => {
  const stateOverride = firestoreIndexes.fieldOverrides.find(
    (entry) =>
      entry.collectionGroup === "LifecycleOperations" &&
      entry.fieldPath === "state",
  );

  assert.ok(stateOverride);
  assert.equal(
    stateOverride.indexes.some(
      (index) =>
        index.queryScope === "COLLECTION_GROUP" &&
        index.order === "ASCENDING",
    ),
    true,
  );
});

test("reconciler dispatches A and B without replacing original actor identity", async () => {
  const employeeOperation = operation({
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    operationId: "07000000-0000-4000-8000-000000000101",
    targetUserUid: "employee-user",
    employeeId: "employee-a",
  });
  const standaloneOperation = operation({
    operationType:
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    operationId: "07000000-0000-4000-8000-000000000102",
    targetUserUid: "standalone-user",
    employeeId: null,
  });
  const firestore = firestoreWith([
    documentSnapshot(employeeOperation),
    documentSnapshot(standaloneOperation),
  ]);
  const calls = [];
  const result = await reconcileLifecycleOperations({
    firestore,
    auth: { getUser() {} },
    cleanupFcm() {},
    resumeEmployeeRetirement: async (input) => {
      calls.push(["A", input.companyId, input.operation.actorUid]);
      return { status: "completed" };
    },
    resumeStandaloneDeletion: async (input) => {
      calls.push(["B", input.companyId, input.operation.actorUid]);
      return { status: "completed-cleanup-pending" };
    },
  });

  assert.deepEqual(result, { scanned: 2, completed: 1, pending: 1, failed: 0 });
  assert.deepEqual(calls, [
    ["A", "company-a", "actor-a"],
    ["B", "company-a", "actor-a"],
  ]);
  assert.deepEqual(firestore.trace[0], [
    "collectionGroup",
    "LifecycleOperations",
  ]);
  assert.deepEqual(firestore.trace.at(-1), ["limit", 50]);
});

test("reconciler isolates failures and reports no operation identifiers", async () => {
  const stored = operation({
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    operationId: "07000000-0000-4000-8000-000000000103",
    targetUserUid: "private-user-id",
    employeeId: "private-employee-id",
  });
  const failures = [];
  const result = await reconcileLifecycleOperations({
    firestore: firestoreWith([documentSnapshot(stored, "private-company-id")]),
    auth: { getUser() {} },
    cleanupFcm() {},
    resumeEmployeeRetirement: async () => {
      const error = new Error("private-email@example.invalid");
      error.code = "retryable";
      error.domainCode = "UPSTREAM_UNAVAILABLE";
      throw error;
    },
    resumeStandaloneDeletion: async () => ({ status: "completed" }),
    onFailure: (failure) => failures.push(failure),
  });

  assert.deepEqual(result, { scanned: 1, completed: 0, pending: 0, failed: 1 });
  assert.deepEqual(failures, [
    {
      operationType: "employee-retirement",
      operationState: "access-revoke-pending",
      errorName: "Error",
      errorCode: "retryable",
      domainCode: "UPSTREAM_UNAVAILABLE",
    },
  ]);
  const serialized = JSON.stringify(failures);
  for (const privateValue of [
    "private-user-id",
    "private-employee-id",
    "private-company-id",
    "private-email@example.invalid",
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});
