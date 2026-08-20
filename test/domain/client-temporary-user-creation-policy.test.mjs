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

test("company admin and strict users:write presets may create", () => {
  for (const actorUser of [
    actor({ isAdmin: true, roles: [] }),
    actor({ roles: ["manager"] }),
    actor({ roles: ["human-resource"] }),
  ]) {
    assert.deepEqual(evaluate(actorUser), { allowed: true, reason: null });
  }
});

test("roles without users:write and direct permissions are denied", () => {
  for (const roles of [["controller"], ["labor"], ["users:write"], []]) {
    assert.equal(
      evaluate(actor({ roles })).reason,
      roles[0] === "users:write"
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
