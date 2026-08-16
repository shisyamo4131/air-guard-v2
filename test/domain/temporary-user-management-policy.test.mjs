import assert from "node:assert/strict";
import test from "node:test";

import {
  TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES,
  TemporaryUserManagementPolicyError,
  assertActorCanManageTemporaryUsers,
} from "../../functions/modules/auth/temporaryUserManagementPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/userAuthCompanyPolicy.js";

const COMPANY_ID = "company-a";

function createActorUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: [],
    ...overrides,
  };
}

test("an active registered company administrator may manage temporary Users", () => {
  assert.doesNotThrow(() =>
    assertActorCanManageTemporaryUsers({
      companyId: COMPANY_ID,
      actorUser: createActorUser({ isAdmin: true }),
    }),
  );
});

test("approved User provisioning presets may manage temporary Users", () => {
  for (const role of ["manager", "human-resource"]) {
    assert.doesNotThrow(() =>
      assertActorCanManageTemporaryUsers({
        companyId: COMPANY_ID,
        actorUser: createActorUser({ roles: [role] }),
      }),
    );
  }
});

test("roles without users:write are denied", () => {
  for (const role of ["controller", "accountant", "labor", "legal"]) {
    assert.throws(
      () =>
        assertActorCanManageTemporaryUsers({
          companyId: COMPANY_ID,
          actorUser: createActorUser({ roles: [role] }),
        }),
      (error) => {
        assert.ok(error instanceof TemporaryUserManagementPolicyError);
        assert.equal(
          error.code,
          TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
        );
        return true;
      },
    );
  }
});

test("a direct permission string or unknown role is rejected", () => {
  for (const role of ["users:write", "unknown-role"]) {
    assert.throws(
      () =>
        assertActorCanManageTemporaryUsers({
          companyId: COMPANY_ID,
          actorUser: createActorUser({ roles: [role] }),
        }),
      (error) => {
        assert.ok(error instanceof TemporaryUserManagementPolicyError);
        assert.equal(
          error.code,
          TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
        );
        return true;
      },
    );
  }
});

test("another-company or temporary actor is rejected by the shared User policy", () => {
  for (const actorUser of [
    createActorUser({ companyId: "company-b", roles: ["manager"] }),
    createActorUser({ isTemporary: true, roles: ["manager"] }),
  ]) {
    assert.throws(
      () =>
        assertActorCanManageTemporaryUsers({
          companyId: COMPANY_ID,
          actorUser,
        }),
      (error) => {
        assert.ok(error instanceof UserAuthCompanyPolicyError);
        assert.equal(
          [
            USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
            USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
          ].includes(error.code),
          true,
        );
        return true;
      },
    );
  }
});

test("disabled and malformed actor states fail closed", () => {
  const cases = [
    {
      actorUser: createActorUser({ disabled: true, roles: ["manager"] }),
      code: TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
    },
    {
      actorUser: createActorUser({ disabled: "false", roles: ["manager"] }),
      code: TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
    },
    {
      actorUser: createActorUser({ isAdmin: "false", roles: ["manager"] }),
      code: TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ADMIN_STATE_INVALID,
    },
    {
      actorUser: createActorUser({ roles: "manager" }),
      code: TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
    },
  ];

  for (const testCase of cases) {
    assert.throws(
      () =>
        assertActorCanManageTemporaryUsers({
          companyId: COMPANY_ID,
          actorUser: testCase.actorUser,
        }),
      (error) => {
        assert.ok(error instanceof TemporaryUserManagementPolicyError);
        assert.equal(error.code, testCase.code);
        return true;
      },
    );
  }
});

test("required inputs are validated", () => {
  for (const input of [
    undefined,
    {},
    { companyId: COMPANY_ID },
    { companyId: " ", actorUser: createActorUser() },
  ]) {
    assert.throws(
      () => assertActorCanManageTemporaryUsers(input),
      (error) => {
        assert.ok(error instanceof TemporaryUserManagementPolicyError);
        assert.equal(
          error.code,
          TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        );
        return true;
      },
    );
  }
});
