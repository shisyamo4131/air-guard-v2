import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTemporaryUserCanBeDeleted,
  TEMPORARY_USER_DELETION_POLICY_ERROR_CODES,
  TemporaryUserDeletionPolicyError,
} from "../../functions/modules/auth/temporaryUserDeletionPolicy.js";

const COMPANY_ID = "company-a";

function createTemporaryUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    ...overrides,
  };
}

function assertPolicyError(input, code) {
  assert.throws(
    () => assertTemporaryUserCanBeDeleted(input),
    (error) => {
      assert.ok(error instanceof TemporaryUserDeletionPolicyError);
      assert.equal(error.code, code);
      return true;
    },
  );
}

test("standalone temporary Users may be deleted", () => {
  for (const employeeId of [undefined, null, ""]) {
    const targetUser = createTemporaryUser();
    if (employeeId !== undefined) {
      targetUser.employeeId = employeeId;
    }

    assert.doesNotThrow(() =>
      assertTemporaryUserCanBeDeleted({
        companyId: COMPANY_ID,
        targetUser,
      }),
    );
  }
});

test("Employee-linked temporary Users may be deleted", () => {
  assert.doesNotThrow(() =>
    assertTemporaryUserCanBeDeleted({
      companyId: COMPANY_ID,
      targetUser: createTemporaryUser({ employeeId: "employee-a" }),
    }),
  );
});

test("required inputs are rejected", () => {
  for (const input of [
    undefined,
    {},
    { companyId: "", targetUser: createTemporaryUser() },
    { companyId: COMPANY_ID },
    { companyId: COMPANY_ID, targetUser: [] },
  ]) {
    assertPolicyError(
      input,
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    );
  }
});

test("another-company targets are rejected", () => {
  assertPolicyError(
    {
      companyId: COMPANY_ID,
      targetUser: createTemporaryUser({ companyId: "company-b" }),
    },
    TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_COMPANY_MISMATCH,
  );
});

test("registered and malformed temporary states are rejected", () => {
  assertPolicyError(
    {
      companyId: COMPANY_ID,
      targetUser: createTemporaryUser({ isTemporary: false }),
    },
    TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_NOT_TEMPORARY,
  );

  for (const isTemporary of [undefined, null, "true", 1]) {
    const targetUser = createTemporaryUser();
    targetUser.isTemporary = isTemporary;
    assertPolicyError(
      { companyId: COMPANY_ID, targetUser },
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES
        .TARGET_TEMPORARY_STATE_INVALID,
    );
  }
});

test("administrator and malformed admin states are rejected", () => {
  assertPolicyError(
    {
      companyId: COMPANY_ID,
      targetUser: createTemporaryUser({ isAdmin: true }),
    },
    TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
  );

  for (const isAdmin of [undefined, null, "false", 0]) {
    const targetUser = createTemporaryUser();
    targetUser.isAdmin = isAdmin;
    assertPolicyError(
      { companyId: COMPANY_ID, targetUser },
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
    );
  }
});

test("disabled and malformed disabled states are rejected", () => {
  assertPolicyError(
    {
      companyId: COMPANY_ID,
      targetUser: createTemporaryUser({ disabled: true }),
    },
    TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE,
  );

  for (const disabled of [undefined, null, "false", 0]) {
    const targetUser = createTemporaryUser();
    targetUser.disabled = disabled;
    assertPolicyError(
      { companyId: COMPANY_ID, targetUser },
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID,
    );
  }
});

test("malformed Employee links are rejected", () => {
  for (const employeeId of [
    " ",
    " employee-a",
    "employee-a ",
    "employee/a",
    1,
    {},
    [],
  ]) {
    assertPolicyError(
      {
        companyId: COMPANY_ID,
        targetUser: createTemporaryUser({ employeeId }),
      },
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_EMPLOYEE_ID_INVALID,
    );
  }
});
