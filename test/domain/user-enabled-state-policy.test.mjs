import assert from "node:assert/strict";
import test from "node:test";

import {
  assertUserEnabledStateChangePolicy,
  USER_ENABLED_STATE_POLICY_ERROR_CODES,
  UserEnabledStatePolicyError,
} from "../../functions/modules/auth/policies/userEnabledStatePolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/policies/userAuthCompanyPolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "admin-a";
const TARGET_UID = "user-a";

function createActorUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    isAdmin: true,
    disabled: false,
    ...overrides,
  };
}

function createTargetUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    isAdmin: false,
    disabled: false,
    ...overrides,
  };
}

function createPolicyInput(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    actorUser: createActorUser(),
    targetUid: TARGET_UID,
    targetUser: createTargetUser(),
    ...overrides,
  };
}

function assertEnabledStatePolicyError(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof UserEnabledStatePolicyError);
    assert.equal(error.name, "UserEnabledStatePolicyError");
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function assertCompanyPolicyError(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof UserAuthCompanyPolicyError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("enabled state policy error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new UserEnabledStatePolicyError(
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "UserEnabledStatePolicyError");
  assert.equal(
    error.code,
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN,
  );
  assert.equal(error.cause, cause);
});

test("enabled state policy error codes are frozen", () => {
  assert.equal(Object.isFrozen(USER_ENABLED_STATE_POLICY_ERROR_CODES), true);
});

test("active company administrator may change another regular User", () => {
  assert.doesNotThrow(() =>
    assertUserEnabledStateChangePolicy(createPolicyInput()),
  );
});

test("target's current disabled value does not affect authorization", () => {
  assert.doesNotThrow(() =>
    assertUserEnabledStateChangePolicy(
      createPolicyInput({ targetUser: createTargetUser({ disabled: true }) }),
    ),
  );
  assert.doesNotThrow(() =>
    assertUserEnabledStateChangePolicy(
      createPolicyInput({ targetUser: createTargetUser({ disabled: false }) }),
    ),
  );
});

test("all required policy inputs must be present", () => {
  assertEnabledStatePolicyError(
    () => assertUserEnabledStateChangePolicy(),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({ targetUser: undefined }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});

test("administrator from another company is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          actorUser: createActorUser({ companyId: "company-b" }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );
});

test("temporary administrator is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          actorUser: createActorUser({ isTemporary: true }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
  );
});

test("administrator with a missing registered state is rejected", () => {
  const actorUser = createActorUser();
  delete actorUser.isTemporary;

  assertCompanyPolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({ actorUser }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  );
});

test("regular User cannot change another User's enabled state", () => {
  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          actorUser: createActorUser({ isAdmin: false }),
        }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN,
  );
});

test("administrator with an invalid disabled state is rejected", () => {
  const actorUser = createActorUser();
  delete actorUser.disabled;

  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({ actorUser }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
  );
});

test("disabled administrator is rejected", () => {
  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          actorUser: createActorUser({ disabled: true }),
        }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
  );
});

test("administrator cannot change their own enabled state", () => {
  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({ targetUid: ACTOR_UID }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.SELF_STATUS_CHANGE_FORBIDDEN,
  );
});

test("target User from another company is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          targetUser: createTargetUser({ companyId: "company-b" }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );
});

test("temporary target User is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          targetUser: createTargetUser({ isTemporary: true }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
  );
});

test("target User with a missing registered state is rejected", () => {
  const targetUser = createTargetUser();
  delete targetUser.isTemporary;

  assertCompanyPolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({ targetUser }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  );
});

test("target User with an invalid admin state is rejected", () => {
  const targetUser = createTargetUser();
  delete targetUser.isAdmin;

  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({ targetUser }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
  );
});

test("administrator target is rejected", () => {
  assertEnabledStatePolicyError(
    () =>
      assertUserEnabledStateChangePolicy(
        createPolicyInput({
          targetUser: createTargetUser({ isAdmin: true }),
        }),
      ),
    USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
  );
});
