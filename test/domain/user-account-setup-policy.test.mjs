import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveUserAccountSetupIdentity,
  resolveUserAccountSetupRegistration,
  resolveUserAccountSetupReservation,
  USER_ACCOUNT_SETUP_POLICY_ERROR_CODES,
  UserAccountSetupPolicyError,
} from "../../functions/modules/auth/policies/userAccountSetupPolicy.js";

const identity = Object.freeze({ authUid: "auth-a", email: "user@example.com" });
const reservation = Object.freeze({ companyId: "company-a", userId: "temp-a" });

function user(overrides = {}) {
  return {
    companyId: "company-a",
    email: "user@example.com",
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    ...overrides,
  };
}

function assertPolicyError(run, code) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof UserAccountSetupPolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("verified Authentication identity is canonicalized before reads", () => {
  const result = resolveUserAccountSetupIdentity({
    authUid: "auth-a",
    authEmail: " User@Example.COM ",
    authEmailVerified: true,
  });
  assert.deepEqual(result, identity);
  assert.equal(Object.isFrozen(result), true);
});

test("invalid identity and unverified email fail closed", () => {
  for (const [input, code] of [
    [undefined, "auth-uid-invalid"],
    [{ authUid: "auth-a", authEmailVerified: true }, "auth-email-invalid"],
    [{ authUid: "auth/a", authEmail: "user@example.com", authEmailVerified: true }, "auth-uid-invalid"],
    [{ authUid: "auth-a", authEmail: "invalid", authEmailVerified: true }, "auth-email-invalid"],
    [{ authUid: "auth-a", authEmail: "user@example.com" }, "email-verified-state-invalid"],
    [{ authUid: "auth-a", authEmail: "user@example.com", authEmailVerified: false }, "email-not-verified"],
  ]) {
    assertPolicyError(() => resolveUserAccountSetupIdentity(input), code);
  }
});

test("email reservation accepts only exact safe pointer fields", () => {
  assert.deepEqual(
    resolveUserAccountSetupReservation({ identity, reservation }),
    reservation,
  );

  for (const value of [
    null,
    [],
    { companyId: "company-a" },
    { companyId: "company/a", userId: "temp-a" },
    { companyId: "company-a", userId: "temp/a" },
    { companyId: "company-a", userId: "temp-a", extra: true },
  ]) {
    assertPolicyError(
      () => resolveUserAccountSetupReservation({ identity, reservation: value }),
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.RESERVATION_STATE_INVALID,
    );
  }
});

test("temporary and registered retry states are distinguished", () => {
  assert.deepEqual(
    resolveUserAccountSetupRegistration({ identity, reservation, user: user() }),
    { mode: "temporary", employeeId: null },
  );
  const retryReservation = { companyId: "company-a", userId: "auth-a" };
  assert.deepEqual(
    resolveUserAccountSetupRegistration({
      identity,
      reservation: retryReservation,
      user: user({ isTemporary: false, employeeId: "employee-a" }),
    }),
    { mode: "registered-retry", employeeId: "employee-a" },
  );
});

test("candidate company, email, protected state, and Employee ID are validated", () => {
  const cases = [
    [user({ companyId: "company-b" }), "registration-company-mismatch"],
    [user({ email: "other@example.com" }), "registration-email-mismatch"],
    [user({ email: "User@Example.COM" }), "registration-email-mismatch"],
    [user({ email: " user@example.com " }), "registration-email-mismatch"],
    [user({ isAdmin: true }), "registration-state-invalid"],
    [user({ disabled: true }), "registration-state-invalid"],
    [user({ employeeId: "employee/a" }), "registration-state-invalid"],
    [user({ employeeId: "" }), "registration-state-invalid"],
    [user({ employeeId: 0 }), "registration-state-invalid"],
    [user({ employeeId: " employee-a" }), "registration-state-invalid"],
  ];
  for (const [candidate, code] of cases) {
    assertPolicyError(
      () =>
        resolveUserAccountSetupRegistration({
          identity,
          reservation,
          user: candidate,
        }),
      code,
    );
  }
});

test("a registered User at a different pointer is not a safe retry", () => {
  assertPolicyError(
    () =>
      resolveUserAccountSetupRegistration({
        identity,
        reservation,
        user: user({ isTemporary: false }),
      }),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_TEMPORARY,
  );
});
