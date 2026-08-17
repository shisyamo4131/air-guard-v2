import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIENT_TEMPORARY_USER_DELETION_REASONS,
  evaluateClientTemporaryUserDeletion,
} from "../../utils/auth/policies/temporaryUserDeletionPolicy.js";

function createActor(overrides = {}) {
  return {
    companyId: "company-1",
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: ["manager"],
    ...overrides,
  };
}

function createTarget(overrides = {}) {
  return {
    docId: "temporary-user-1",
    companyId: "company-1",
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    employeeId: null,
    ...overrides,
  };
}

function evaluate({ actorUser, targetUser, companyId, employeeId } = {}) {
  return evaluateClientTemporaryUserDeletion({
    companyId: companyId === undefined ? "company-1" : companyId,
    actorUser: actorUser === undefined ? createActor() : actorUser,
    targetUser: targetUser === undefined ? createTarget() : targetUser,
    ...(employeeId === undefined ? {} : { employeeId }),
  });
}

test("company administrators and approved users:write presets may delete", () => {
  for (const actorUser of [
    createActor({ isAdmin: true, roles: [] }),
    createActor({ roles: ["manager"] }),
    createActor({ roles: ["human-resource"] }),
  ]) {
    assert.deepEqual(evaluate({ actorUser }), {
      allowed: true,
      reason: null,
    });
  }
});

test("actors without a strict preset permission fail closed", () => {
  for (const roles of [
    ["controller"],
    ["users:write"],
    ["super-user"],
    ["unknown-role"],
    "manager",
    null,
  ]) {
    assert.equal(evaluate({ actorUser: createActor({ roles }) }).allowed, false);
  }

  assert.equal(
    evaluate({ actorUser: createActor({ roles: ["controller"] }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_PERMISSION_DENIED,
  );
  assert.equal(
    evaluate({ actorUser: createActor({ roles: ["unknown-role"] }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_ROLES_INVALID,
  );
});

test("temporary or disabled actors are denied", () => {
  assert.equal(
    evaluate({ actorUser: createActor({ isTemporary: true }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_NOT_REGISTERED,
  );
  assert.equal(
    evaluate({ actorUser: createActor({ disabled: true }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_NOT_ACTIVE,
  );
});

test("company mismatches are denied for either actor or target", () => {
  assert.equal(
    evaluate({ actorUser: createActor({ companyId: "company-2" }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_COMPANY_MISMATCH,
  );
  assert.equal(
    evaluate({ targetUser: createTarget({ companyId: "company-2" }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_COMPANY_MISMATCH,
  );
});

test("only active non-admin temporary targets are allowed", () => {
  assert.equal(
    evaluate({ targetUser: createTarget({ isTemporary: false }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_NOT_TEMPORARY,
  );
  assert.equal(
    evaluate({ targetUser: createTarget({ isAdmin: true }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_IS_ADMIN,
  );
  assert.equal(
    evaluate({ targetUser: createTarget({ disabled: true }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_NOT_ACTIVE,
  );
});

test("invalid identifiers and malformed state are denied", () => {
  for (const companyId of ["", " company-1", "company/1", null]) {
    assert.equal(evaluate({ companyId }).allowed, false);
  }
  for (const docId of ["", " temporary-user-1", "temporary/user-1", null]) {
    assert.equal(
      evaluate({ targetUser: createTarget({ docId }) }).reason,
      CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_ID_INVALID,
    );
  }
  assert.equal(
    evaluate({ targetUser: createTarget({ isTemporary: "true" }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_TEMPORARY_STATE_INVALID,
  );
  assert.equal(
    evaluate({ targetUser: createTarget({ employeeId: " employee-1" }) }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_EMPLOYEE_ID_INVALID,
  );
});

test("Employee context permits only the linked temporary User", () => {
  assert.deepEqual(
    evaluate({
      targetUser: createTarget({ employeeId: "employee-1" }),
      employeeId: "employee-1",
    }),
    { allowed: true, reason: null },
  );
  assert.equal(
    evaluate({
      targetUser: createTarget({ employeeId: "employee-2" }),
      employeeId: "employee-1",
    }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_EMPLOYEE_MISMATCH,
  );
  assert.equal(
    evaluate({ employeeId: "employee/1" }).reason,
    CLIENT_TEMPORARY_USER_DELETION_REASONS.EMPLOYEE_CONTEXT_ID_INVALID,
  );
});

test("missing or malformed inputs fail closed without throwing", () => {
  for (const input of [
    undefined,
    {},
    { companyId: "company-1", actorUser: null, targetUser: createTarget() },
    { companyId: "company-1", actorUser: createActor(), targetUser: [] },
  ]) {
    const result = evaluateClientTemporaryUserDeletion(input);
    assert.equal(result.allowed, false);
    assert.equal(typeof result.reason, "string");
  }
});
