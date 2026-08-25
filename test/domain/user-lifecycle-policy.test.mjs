import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLifecycleOperationHistoryActor,
  assertEmployeeReinstatementActor,
  assertEmployeeReinstatementTarget,
  assertEmployeeRetirementActor,
  assertEmployeeRetirementTarget,
  assertStandaloneRegisteredUserDeletionActor,
  assertStandaloneRegisteredUserDeletionTarget,
  EMPLOYEE_REINSTATEMENT_REASON_CODES,
  resolveEmployeeReinstatementInput,
  resolveEmployeeRetirementInput,
  resolveLifecycleOperationHistoryInput,
  resolveStandaloneRegisteredUserDeletionInput,
  USER_LIFECYCLE_POLICY_ERROR_CODES,
  UserLifecyclePolicyError,
} from "../../functions/modules/auth/policies/userLifecyclePolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const TARGET_UID = "target-a";
const EMPLOYEE_ID = "employee-a";
const OPERATION_ID = "018f0f5e-7b4a-4a1f-8f35-cd5658b762d1";
const SOURCE_OPERATION_ID = "018f0f5e-7b4a-4a1f-9f35-cd5658b762d2";

function actor(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: ["human-resource"],
    ...overrides,
  };
}

function targetUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: [],
    ...overrides,
  };
}

function assertPolicyError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof UserLifecyclePolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("lifecycle policy error preserves its code and cause", () => {
  const cause = new Error("cause");
  const error = new UserLifecyclePolicyError("test-code", "message", {
    cause,
  });

  assert.equal(error.code, "test-code");
  assert.equal(error.cause, cause);
  assert.equal(error.name, "UserLifecyclePolicyError");
});

test("lifecycle policy error codes and reinstatement reasons are frozen", () => {
  assert.equal(Object.isFrozen(USER_LIFECYCLE_POLICY_ERROR_CODES), true);
  assert.equal(Object.isFrozen(EMPLOYEE_REINSTATEMENT_REASON_CODES), true);
});

test("history input accepts only exact cursor null or lower-case UUID v4", () => {
  assert.deepEqual(resolveLifecycleOperationHistoryInput({ cursor: null }), {
    cursor: null,
  });
  assert.deepEqual(
    resolveLifecycleOperationHistoryInput({ cursor: OPERATION_ID }),
    { cursor: OPERATION_ID },
  );
  assert.equal(
    Object.isFrozen(
      resolveLifecycleOperationHistoryInput({ cursor: OPERATION_ID }),
    ),
    true,
  );

  for (const input of [
    undefined,
    null,
    [],
    {},
    { cursor: null, companyId: COMPANY_ID },
    { cursor: null, pageSize: 20 },
    { cursor: "not-a-uuid" },
    { cursor: OPERATION_ID.toUpperCase() },
    { cursor: "018f0f5e-7b4a-3a1f-8f35-cd5658b762d1" },
  ]) {
    assertPolicyError(
      () => resolveLifecycleOperationHistoryInput(input),
      input && !Array.isArray(input) && Object.keys(input).length > 1
        ? USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD
        : input?.cursor && input.cursor !== OPERATION_ID
          ? USER_LIFECYCLE_POLICY_ERROR_CODES.OPERATION_ID_INVALID
          : USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
    );
  }
});

test("history actor is limited to active registered same-company administrators", () => {
  assert.doesNotThrow(() =>
    assertLifecycleOperationHistoryActor({
      companyId: COMPANY_ID,
      actorUser: actor({ isAdmin: true, roles: [] }),
    }),
  );

  for (const [deniedActor, expectedCode] of [
    [
      actor({ isAdmin: false, roles: ["manager"] }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
    ],
    [
      actor({ isAdmin: false, roles: ["human-resource"] }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
    ],
    [
      actor({ isAdmin: false, roles: ["users:write"] }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
    ],
    [
      actor({ isAdmin: true, roles: [], isTemporary: true }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
    ],
    [
      actor({ isAdmin: true, roles: [], disabled: true }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
    ],
    [
      actor({ isAdmin: true, roles: [], companyId: "company-b" }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
    ],
  ]) {
    assertPolicyError(
      () =>
        assertLifecycleOperationHistoryActor({
          companyId: COMPANY_ID,
          actorUser: deniedActor,
        }),
      expectedCode,
    );
  }
});

test("retirement input accepts only the exact normalized contract", () => {
  const input = {
    operationId: OPERATION_ID,
    employeeId: EMPLOYEE_ID,
    terminationDate: "2026-08-24",
    reasonOfTermination: "契約満了",
  };

  assert.deepEqual(resolveEmployeeRetirementInput(input), input);
  assert.equal(Object.isFrozen(resolveEmployeeRetirementInput(input)), true);
});

test("retirement input rejects missing, unknown, malformed, future-agnostic, and long values", () => {
  assertPolicyError(
    () =>
      resolveEmployeeRetirementInput({
        operationId: OPERATION_ID,
        employeeId: EMPLOYEE_ID,
        terminationDate: "2026-08-24",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
  );
  assertPolicyError(
    () =>
      resolveEmployeeRetirementInput({
        operationId: OPERATION_ID,
        employeeId: EMPLOYEE_ID,
        terminationDate: "2026-08-24",
        reasonOfTermination: "契約満了",
        companyId: COMPANY_ID,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
  );

  for (const operationId of [
    OPERATION_ID.toUpperCase(),
    "018f0f5e-7b4a-3a1f-8f35-cd5658b762d1",
    "not-a-uuid",
  ]) {
    assertPolicyError(
      () =>
        resolveEmployeeRetirementInput({
          operationId,
          employeeId: EMPLOYEE_ID,
          terminationDate: "2026-08-24",
          reasonOfTermination: "契約満了",
        }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.OPERATION_ID_INVALID,
    );
  }

  for (const terminationDate of [
    "2026-02-30",
    "2026-8-24",
    "0000-01-01",
  ]) {
    assertPolicyError(
      () =>
        resolveEmployeeRetirementInput({
          operationId: OPERATION_ID,
          employeeId: EMPLOYEE_ID,
          terminationDate,
          reasonOfTermination: "契約満了",
        }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.DATE_INVALID,
    );
  }

  for (const reasonOfTermination of ["", " 退職", "123456789012345678901"]) {
    assertPolicyError(
      () =>
        resolveEmployeeRetirementInput({
          operationId: OPERATION_ID,
          employeeId: EMPLOYEE_ID,
          terminationDate: "2026-08-24",
          reasonOfTermination,
        }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.REASON_INVALID,
    );
  }

  for (const employeeId of ["", "employee/a", "employee a"]) {
    assertPolicyError(
      () =>
        resolveEmployeeRetirementInput({
          operationId: OPERATION_ID,
          employeeId,
          terminationDate: "2026-08-24",
          reasonOfTermination: "契約満了",
        }),
      USER_LIFECYCLE_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
    );
  }
});

test("retirement actor allows human-resource and administrator but not manager", () => {
  assert.doesNotThrow(() =>
    assertEmployeeRetirementActor({
      companyId: COMPANY_ID,
      actorUser: actor(),
      employeeId: EMPLOYEE_ID,
    }),
  );
  assert.doesNotThrow(() =>
    assertEmployeeRetirementActor({
      companyId: COMPANY_ID,
      actorUser: actor({ isAdmin: true, roles: [] }),
      employeeId: EMPLOYEE_ID,
    }),
  );
  assertPolicyError(
    () =>
      assertEmployeeRetirementActor({
        companyId: COMPANY_ID,
        actorUser: actor({ roles: ["manager"] }),
        employeeId: EMPLOYEE_ID,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
  );
});

test("retirement actor rejects direct permission strings, inactive actors, other tenants, and self", () => {
  assertPolicyError(
    () =>
      assertEmployeeRetirementActor({
        companyId: COMPANY_ID,
        actorUser: actor({ roles: ["employees:terminate"] }),
        employeeId: EMPLOYEE_ID,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
  );
  assertPolicyError(
    () =>
      assertEmployeeRetirementActor({
        companyId: COMPANY_ID,
        actorUser: actor({ disabled: true }),
        employeeId: EMPLOYEE_ID,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
  );
  assert.throws(() =>
    assertEmployeeRetirementActor({
      companyId: COMPANY_ID,
      actorUser: actor({ companyId: "company-b" }),
      employeeId: EMPLOYEE_ID,
    }),
  );
  assertPolicyError(
    () =>
      assertEmployeeRetirementActor({
        companyId: COMPANY_ID,
        actorUser: actor({ employeeId: EMPLOYEE_ID }),
        employeeId: EMPLOYEE_ID,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.SELF_OPERATION_DENIED,
  );
});

test("retirement target accepts hire date through server today JST inclusively", () => {
  for (const terminationDate of ["2020-04-01", "2026-08-24"]) {
    assert.doesNotThrow(() =>
      assertEmployeeRetirementTarget({
        employee: { employmentStatus: "ACTIVE", dateOfHire: "2020-04-01" },
        terminationDate,
        serverTodayJst: "2026-08-24",
      }),
    );
  }
});

test("retirement target rejects non-active, pre-hire, future, and malformed dates", () => {
  assertPolicyError(
    () =>
      assertEmployeeRetirementTarget({
        employee: { employmentStatus: "RESIGNED", dateOfHire: "2020-04-01" },
        terminationDate: "2026-08-24",
        serverTodayJst: "2026-08-24",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_STATE_INVALID,
  );
  assertPolicyError(
    () =>
      assertEmployeeRetirementTarget({
        employee: { employmentStatus: "ACTIVE", dateOfHire: "2020-04-01" },
        terminationDate: "2020-03-31",
        serverTodayJst: "2026-08-24",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TERMINATION_DATE_BEFORE_HIRE,
  );
  assertPolicyError(
    () =>
      assertEmployeeRetirementTarget({
        employee: { employmentStatus: "ACTIVE", dateOfHire: "2020-04-01" },
        terminationDate: "2026-08-25",
        serverTodayJst: "2026-08-24",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TERMINATION_DATE_IN_FUTURE,
  );
  assertPolicyError(
    () =>
      assertEmployeeRetirementTarget({
        employee: { employmentStatus: "ACTIVE", dateOfHire: "2020-02-30" },
        terminationDate: "2026-08-24",
        serverTodayJst: "2026-08-24",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.DATE_INVALID,
  );
});

test("standalone deletion input accepts exact fields and rejects protected input", () => {
  const input = {
    operationId: OPERATION_ID,
    targetUserId: TARGET_UID,
    reason: "利用終了",
  };
  assert.deepEqual(resolveStandaloneRegisteredUserDeletionInput(input), input);
  assertPolicyError(
    () =>
      resolveStandaloneRegisteredUserDeletionInput({
        ...input,
        companyId: COMPANY_ID,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
  );

  for (const invalidInput of [
    { ...input, operationId: "not-a-uuid" },
    { ...input, targetUserId: "target/user" },
    { ...input, reason: "" },
  ]) {
    assert.throws(() =>
      resolveStandaloneRegisteredUserDeletionInput(invalidInput),
    );
  }
});

test("standalone deletion actor requires an active registered administrator", () => {
  assert.doesNotThrow(() =>
    assertStandaloneRegisteredUserDeletionActor({
      companyId: COMPANY_ID,
      actorUser: actor({ isAdmin: true, roles: [] }),
    }),
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionActor({
        companyId: COMPANY_ID,
        actorUser: actor(),
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionActor({
        companyId: COMPANY_ID,
        actorUser: actor({ isAdmin: true, disabled: true, roles: [] }),
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
  );
});

test("standalone deletion target accepts active and disabled standalone Users", () => {
  for (const disabled of [false, true]) {
    assert.doesNotThrow(() =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser({ disabled }),
        targetAuthIsSuperUser: false,
      }),
    );
  }
});

test("standalone deletion target rejects self, temporary, admin, super-user, Employee link, and other tenant", () => {
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: ACTOR_UID,
        targetUser: targetUser(),
        targetAuthIsSuperUser: false,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.SELF_OPERATION_DENIED,
  );
  assert.throws(() =>
    assertStandaloneRegisteredUserDeletionTarget({
      companyId: COMPANY_ID,
      actorUid: ACTOR_UID,
      targetUserId: TARGET_UID,
      targetUser: targetUser({ isTemporary: true }),
      targetAuthIsSuperUser: false,
    }),
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser({ isAdmin: true }),
        targetAuthIsSuperUser: false,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser(),
        targetAuthIsSuperUser: true,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_IS_SUPER_USER,
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser({ employeeId: EMPLOYEE_ID }),
        targetAuthIsSuperUser: false,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_HAS_EMPLOYEE,
  );
  assert.throws(() =>
    assertStandaloneRegisteredUserDeletionTarget({
      companyId: COMPANY_ID,
      actorUid: ACTOR_UID,
      targetUserId: TARGET_UID,
      targetUser: targetUser({ companyId: "company-b" }),
      targetAuthIsSuperUser: false,
    }),
  );
});

test("standalone deletion target rejects malformed protected states and Employee links", () => {
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser({ disabled: "false" }),
        targetAuthIsSuperUser: false,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_USER_INVALID,
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser({ isAdmin: "false" }),
        targetAuthIsSuperUser: false,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser(),
        targetAuthIsSuperUser: "false",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_SUPER_USER_STATE_INVALID,
  );
  assertPolicyError(
    () =>
      assertStandaloneRegisteredUserDeletionTarget({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        targetUser: targetUser({ employeeId: "broken/link" }),
        targetAuthIsSuperUser: false,
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_USER_INVALID,
  );
});

test("reinstatement input accepts only mistaken retirement and exact IDs", () => {
  const input = {
    operationId: OPERATION_ID,
    employeeId: EMPLOYEE_ID,
    reversesOperationId: SOURCE_OPERATION_ID,
    correctionReasonCode:
      EMPLOYEE_REINSTATEMENT_REASON_CODES.MISTAKEN_RETIREMENT,
  };
  assert.deepEqual(resolveEmployeeReinstatementInput(input), input);
  assertPolicyError(
    () =>
      resolveEmployeeReinstatementInput({
        ...input,
        correctionReasonCode: "REHIRE",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.CORRECTION_REASON_INVALID,
  );
  assertPolicyError(
    () =>
      resolveEmployeeReinstatementInput({
        ...input,
        reversesOperationId: "not-a-uuid",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.OPERATION_ID_INVALID,
  );
  assertPolicyError(
    () =>
      resolveEmployeeReinstatementInput({
        ...input,
        effectiveDate: "2026-08-24",
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
  );
});

test("reinstatement actor is administrator-only regardless of termination permission", () => {
  assert.doesNotThrow(() =>
    assertEmployeeReinstatementActor({
      companyId: COMPANY_ID,
      actorUser: actor({ isAdmin: true, roles: [] }),
    }),
  );
  assertPolicyError(
    () =>
      assertEmployeeReinstatementActor({
        companyId: COMPANY_ID,
        actorUser: actor(),
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
  );
});

test("reinstatement target must already be resigned", () => {
  assert.doesNotThrow(() =>
    assertEmployeeReinstatementTarget({
      employee: { employmentStatus: "RESIGNED" },
    }),
  );
  assertPolicyError(
    () =>
      assertEmployeeReinstatementTarget({
        employee: { employmentStatus: "ACTIVE" },
      }),
    USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_STATE_INVALID,
  );
});
