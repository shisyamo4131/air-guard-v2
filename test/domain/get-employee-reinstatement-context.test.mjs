import assert from "node:assert/strict";
import test from "node:test";

import { getEmployeeReinstatementContext } from "../../functions/modules/auth/lifecycle/getEmployeeReinstatementContext.js";
import {
  createEmployeeOnlyRetirementOperationRecord,
  createNextEmployeeLifecycleHead,
  LIFECYCLE_OPERATION_TYPES,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";
import { resolveEmployeeReinstatementContextInput } from "../../functions/modules/auth/policies/userLifecyclePolicy.js";

const companyId = "company-a";
const employeeId = "employee-a";
const operationId = "11111111-1111-4111-8111-111111111111";
const timestamp = {};

function snapshot(data) {
  return { exists: data !== undefined, data: () => data };
}

function firestoreFixture(overrides = {}) {
  const source = createEmployeeOnlyRetirementOperationRecord({
    operationId,
    actorUid: "actor-a",
    actorDisplayName: "管理者",
    employeeId,
    terminationDate: "2026-08-24",
    reasonOfTermination: "本人都合",
    requestFingerprint: "a".repeat(64),
    timestamp,
  });
  const records = new Map([
    [`Companies/${companyId}/Users/actor-a`, {
      docId: "actor-a",
      companyId,
      displayName: "管理者",
      disabled: false,
      isTemporary: false,
      isAdmin: true,
      roles: [],
    }],
    [`Companies/${companyId}/Employees/${employeeId}`, {
      docId: employeeId,
      companyId,
      employmentStatus: "RESIGNED",
    }],
    [`Companies/${companyId}/EmployeeLifecycleHeads/${employeeId}`,
      createNextEmployeeLifecycleHead({
        operationId,
        operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
        timestamp,
      })],
    [`Companies/${companyId}/LifecycleOperations/${operationId}`, source],
  ]);
  for (const [path, value] of Object.entries(overrides)) records.set(path, value);
  return {
    doc(path) {
      return { get: async () => snapshot(records.get(path)) };
    },
    collection() {
      return {
        where() {
          return {
            limit() {
              return { get: async () => ({ docs: [] }) };
            },
          };
        },
      };
    },
  };
}

test("reinstatement context input is exact and minimal", () => {
  assert.deepEqual(resolveEmployeeReinstatementContextInput({ employeeId }), {
    employeeId,
  });
  assert.throws(() =>
    resolveEmployeeReinstatementContextInput({ employeeId, companyId }),
  );
});

test("administrator receives only the latest eligible retirement reference", async () => {
  const result = await getEmployeeReinstatementContext({
    firestore: firestoreFixture(),
    identity: { uid: "actor-a", companyId, isSuperUser: false },
    input: { employeeId },
  });
  assert.deepEqual(result, {
    eligible: true,
    employeeId,
    reversesOperationId: operationId,
    requiresUserReprovisioning: false,
  });
});

test("non-administrator cannot read reinstatement context", async () => {
  const actorPath = `Companies/${companyId}/Users/actor-a`;
  await assert.rejects(
    getEmployeeReinstatementContext({
      firestore: firestoreFixture({
        [actorPath]: {
          docId: "actor-a",
          companyId,
          disabled: false,
          isTemporary: false,
          isAdmin: false,
          roles: ["human-resource"],
        },
      }),
      identity: { uid: "actor-a", companyId, isSuperUser: false },
      input: { employeeId },
    }),
    (error) => error.code === "actor-not-allowed",
  );
});
