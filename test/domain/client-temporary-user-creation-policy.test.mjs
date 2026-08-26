import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_TEMPORARY_USER_CREATION_REASONS as REASONS,
  evaluateClientTemporaryUserCreation,
} from "../../utils/auth/policies/temporaryUserCreationPolicy.js";

function actor(overrides = {}) {
  return {
    companyId: "COMPANY_A",
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: ["manager"],
    ...overrides,
  };
}

function evaluate(actorUser = actor(), companyId = "COMPANY_A") {
  return evaluateClientTemporaryUserCreation({ companyId, actorUser });
}

test("approved provisioning actors expose role assignment separately", () => {
  assert.deepEqual(evaluate(actor({ isAdmin: true, roles: [] })), {
    allowed: true,
    reason: null,
    canAssignRoles: true,
  });
  assert.deepEqual(evaluate(actor({ roles: ["manager"] })), {
    allowed: true,
    reason: null,
    canAssignRoles: true,
  });
  assert.deepEqual(evaluate(actor({ roles: ["human-resource"] })), {
    allowed: true,
    reason: null,
    canAssignRoles: false,
  });
});

test("roles without users:provision and direct permissions are denied", () => {
  for (const roles of [["controller"], ["labor"], ["users:provision"], []]) {
    assert.equal(
      evaluate(actor({ roles })).reason,
      roles[0] === "users:provision"
        ? REASONS.ACTOR_ROLES_INVALID
        : REASONS.ACTOR_PERMISSION_DENIED,
    );
  }
});

test("unknown roles and malformed actor states fail closed", () => {
  const cases = [
    [actor({ roles: ["unknown"] }), REASONS.ACTOR_ROLES_INVALID],
    [actor({ roles: "manager" }), REASONS.ACTOR_ROLES_INVALID],
    [actor({ isTemporary: true }), REASONS.ACTOR_NOT_REGISTERED],
    [actor({ disabled: true }), REASONS.ACTOR_NOT_ACTIVE],
    [actor({ companyId: "COMPANY_B" }), REASONS.ACTOR_COMPANY_MISMATCH],
    [null, REASONS.ACTOR_INVALID],
  ];
  for (const [actorUser, reason] of cases) {
    assert.equal(evaluate(actorUser).reason, reason);
  }
  assert.equal(evaluate(actor(), "bad/id").reason, REASONS.COMPANY_ID_INVALID);
});
