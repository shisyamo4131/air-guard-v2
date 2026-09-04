import assert from "node:assert/strict";
import test from "node:test";
import {
  OUTSOURCER_MUTATIONS,
  OUTSOURCER_MUTATION_REASONS,
  evaluateOutsourcerMutation,
} from "../../utils/auth/policies/outsourcerMutationPolicy.js";

function context(overrides = {}) {
  return {
    operation: OUTSOURCER_MUTATIONS.CREATE,
    uid: "actor-a",
    companyId: "company-a",
    isSuperUser: false,
    isSuperUserClaimValid: true,
    actorUser: {
      docId: "actor-a",
      companyId: "company-a",
      isTemporary: false,
      disabled: false,
      isAdmin: false,
      roles: ["manager"],
    },
    ...overrides,
  };
}

for (const operation of [
  OUTSOURCER_MUTATIONS.CREATE,
  OUTSOURCER_MUTATIONS.UPDATE,
]) {
  test(`${operation} allows an exact manager preset`, () => {
    assert.deepEqual(evaluateOutsourcerMutation(context({ operation })), {
      allowed: true,
      reason: null,
      message: null,
    });
  });

  test(`${operation} allows a company admin including admin plus super-user`, () => {
    for (const isSuperUser of [false, true]) {
      const decision = evaluateOutsourcerMutation(
        context({
          operation,
          isSuperUser,
          actorUser: {
            ...context().actorUser,
            isAdmin: true,
            roles: ["unknown-role"],
          },
        }),
      );
      assert.equal(decision.allowed, true);
    }
  });
}

test("delete remains denied for every actor", () => {
  for (const actor of [
    context({ operation: OUTSOURCER_MUTATIONS.DELETE }),
    context({
      operation: OUTSOURCER_MUTATIONS.DELETE,
      isSuperUser: true,
      actorUser: { ...context().actorUser, isAdmin: true },
    }),
    { operation: OUTSOURCER_MUTATIONS.DELETE },
  ]) {
    const decision = evaluateOutsourcerMutation(actor);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, OUTSOURCER_MUTATION_REASONS.DELETE_DENIED);
  }
});

test("non-admin writers must have only the exact manager preset", () => {
  for (const roles of [
    [],
    ["controller"],
    ["accountant"],
    ["human-resource"],
    ["labor"],
    ["legal"],
    ["outsourcers:write"],
    ["unknown-role"],
    ["toString"],
    ["constructor"],
    ["__proto__"],
    ["manager", "controller"],
    ["manager", "unknown-role"],
    ["manager", "manager"],
  ]) {
    const decision = evaluateOutsourcerMutation(
      context({ actorUser: { ...context().actorUser, roles } }),
    );
    assert.equal(decision.allowed, false, JSON.stringify(roles));
  }

  assert.equal(
    evaluateOutsourcerMutation(
      context({ actorUser: { ...context().actorUser, roles: "manager" } }),
    ).reason,
    OUTSOURCER_MUTATION_REASONS.ACTOR_ROLES_INVALID,
  );
});

test("non-admin super-users cannot use the manager preset", () => {
  const decision = evaluateOutsourcerMutation(context({ isSuperUser: true }));
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.reason,
    OUTSOURCER_MUTATION_REASONS.ACTOR_PERMISSION_DENIED,
  );
});

test("identity and active registered tenant membership fail closed", () => {
  const cases = [
    { expected: "identity-invalid", override: { uid: null } },
    { expected: "identity-invalid", override: { uid: "bad/id" } },
    { expected: "identity-invalid", override: { companyId: null } },
    { expected: "identity-invalid", override: { companyId: "bad/id" } },
    { expected: "identity-invalid", override: { isSuperUser: "false" } },
    { expected: "identity-invalid", override: { isSuperUserClaimValid: false } },
    { expected: "actor-invalid", override: { actorUser: null } },
    {
      expected: "actor-uid-mismatch",
      override: { actorUser: { ...context().actorUser, docId: "actor-b" } },
    },
    {
      expected: "actor-uid-mismatch",
      override: {
        actorUser: { ...context().actorUser, docId: undefined },
      },
    },
    {
      expected: "actor-uid-mismatch",
      override: { actorUser: { ...context().actorUser, docId: "bad/id" } },
    },
    {
      expected: "actor-company-mismatch",
      override: {
        actorUser: { ...context().actorUser, companyId: "company-b" },
      },
    },
    {
      expected: "actor-not-registered",
      override: { actorUser: { ...context().actorUser, isTemporary: true } },
    },
    {
      expected: "actor-not-registered",
      override: {
        actorUser: { ...context().actorUser, isTemporary: undefined },
      },
    },
    {
      expected: "actor-not-active",
      override: { actorUser: { ...context().actorUser, disabled: true } },
    },
    {
      expected: "actor-not-active",
      override: { actorUser: { ...context().actorUser, disabled: undefined } },
    },
    {
      expected: "actor-admin-state-invalid",
      override: { actorUser: { ...context().actorUser, isAdmin: undefined } },
    },
  ];

  for (const { expected, override } of cases) {
    assert.equal(
      evaluateOutsourcerMutation(context(override)).reason,
      expected,
    );
  }
});

test("invalid operations fail closed", () => {
  for (const operation of [undefined, null, "ARCHIVE", "create", 1]) {
    assert.equal(
      evaluateOutsourcerMutation(context({ operation })).reason,
      OUTSOURCER_MUTATION_REASONS.INVALID_OPERATION,
    );
  }
});
