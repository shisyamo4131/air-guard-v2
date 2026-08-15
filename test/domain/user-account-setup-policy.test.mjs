import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveUserAccountSetupRegistration,
  USER_ACCOUNT_SETUP_POLICY_ERROR_CODES,
  UserAccountSetupPolicyError,
} from "../../functions/modules/auth/userAccountSetupPolicy.js";

const AUTH_UID = "user-a";
const AUTH_EMAIL = "user@example.com";

function createRegistration(overrides = {}) {
  return {
    id: "temporary-user-a",
    pathCompanyId: "company-a",
    companyId: "company-a",
    email: AUTH_EMAIL,
    isTemporary: true,
    ...overrides,
  };
}

function createPolicyInput(overrides = {}) {
  return {
    authUid: AUTH_UID,
    authEmail: AUTH_EMAIL,
    authEmailVerified: true,
    registrations: [createRegistration()],
    ...overrides,
  };
}

function assertSetupPolicyError(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof UserAccountSetupPolicyError);
    assert.equal(error.name, "UserAccountSetupPolicyError");
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("setup policy error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new UserAccountSetupPolicyError(
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "UserAccountSetupPolicyError");
  assert.equal(
    error.code,
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
  );
  assert.equal(error.cause, cause);
});

test("setup policy error codes are frozen", () => {
  assert.equal(Object.isFrozen(USER_ACCOUNT_SETUP_POLICY_ERROR_CODES), true);
});

test("verified Authentication User receives the unique matching registration", () => {
  const input = createPolicyInput();

  const registration = resolveUserAccountSetupRegistration(input);

  assert.equal(registration, input.registrations[0]);
});

test("policy validation does not mutate its inputs", () => {
  const input = createPolicyInput();
  const before = structuredClone(input);

  resolveUserAccountSetupRegistration(input);

  assert.deepEqual(input, before);
});

test("required Authentication fields and registration list must be present", () => {
  assertSetupPolicyError(
    () => resolveUserAccountSetupRegistration(),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({ registrations: undefined }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});

test("invalid email verified state is rejected", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({ authEmailVerified: undefined }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_VERIFIED_STATE_INVALID,
  );
});

test("unverified email is rejected", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({ authEmailVerified: false }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
  );
});

test("missing pre-registration is rejected", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({ registrations: [] }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_FOUND,
  );
});

test("multiple pre-registrations for the same email are rejected", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({
          registrations: [
            createRegistration(),
            createRegistration({
              id: "temporary-user-b",
              companyId: "company-b",
            }),
          ],
        }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_UNIQUE,
  );
});

test("malformed pre-registration is rejected", () => {
  const registration = createRegistration();
  delete registration.companyId;

  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({ registrations: [registration] }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
  );
});

test("pre-registration company must match its document path", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({
          registrations: [createRegistration({ companyId: "company-b" })],
        }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_COMPANY_MISMATCH,
  );
});

test("pre-registration email must exactly match the authenticated email", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({
          registrations: [createRegistration({ email: "other@example.com" })],
        }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_EMAIL_MISMATCH,
  );
});

test("already registered User cannot be registered again", () => {
  assertSetupPolicyError(
    () =>
      resolveUserAccountSetupRegistration(
        createPolicyInput({
          registrations: [createRegistration({ isTemporary: false })],
        }),
      ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_TEMPORARY,
  );
});
