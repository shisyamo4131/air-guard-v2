import assert from "node:assert/strict";
import test from "node:test";
import { Company, User } from "../../functions/node_modules/@shisyamo4131/air-guard-v2-schemas/index.js";
import {
  INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES,
  INITIAL_ADMIN_ACCOUNT_POLICY_LENGTHS,
  InitialAdminAccountPolicyError,
  assertInitialAdminRetryState,
  resolveInitialAdminAccountInput,
  resolveInitialAdminAuthIdentity,
  resolveInitialAdminReservation,
} from "../../functions/modules/auth/initialAdminAccountPolicy.js";

const input = {
  companyName: "警備会社",
  companyNameKana: "ケイビガイシャ",
  displayName: "管理者",
};
const authUser = {
  uid: "auth-a",
  email: "Admin@Example.COM",
  emailVerified: true,
  disabled: false,
  customClaims: {},
};

function policyError(run, code) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof InitialAdminAccountPolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

function identity(overrides = {}) {
  return resolveInitialAdminAuthIdentity({
    tokenUid: "auth-a",
    tokenEmail: "admin@example.com",
    tokenEmailVerified: true,
    authUser,
    ...overrides,
  });
}

test("input uses an exact allowlist and schema length contract", () => {
  assert.deepEqual(resolveInitialAdminAccountInput(input), input);
  assert.deepEqual(INITIAL_ADMIN_ACCOUNT_POLICY_LENGTHS, {
    companyName: Company.classProps.companyName.length,
    companyNameKana: Company.classProps.companyNameKana.length,
    displayName: User.classProps.displayName.length,
  });
  for (const invalid of [
    undefined,
    { ...input, extra: true },
    { ...input, companyName: "" },
    { ...input, companyName: " 警備会社" },
    { ...input, companyName: "a".repeat(21) },
    { ...input, companyNameKana: "a".repeat(41) },
    { ...input, displayName: "a".repeat(7) },
  ]) {
    policyError(
      () => resolveInitialAdminAccountInput(invalid),
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.INPUT_INVALID,
    );
  }
});

test("token and current Auth identity are canonicalized and reconciled", () => {
  assert.deepEqual(identity(), {
    uid: "auth-a",
    email: "admin@example.com",
    tokenCompanyId: undefined,
    currentCompanyId: undefined,
    isSuperUser: false,
    currentClaims: {},
  });
  const retry = identity({
    tokenCompanyId: undefined,
    authUser: {
      ...authUser,
      customClaims: { companyId: "company-a", isSuperUser: true },
    },
  });
  assert.equal(retry.currentCompanyId, "company-a");
  assert.equal(retry.isSuperUser, true);

  class UserRecordFixture {
    constructor() {
      Object.assign(this, authUser);
    }
  }
  assert.equal(identity({ authUser: new UserRecordFixture() }).uid, "auth-a");
});

test("malformed or mismatched Auth identity fails closed", () => {
  for (const overrides of [
    { tokenUid: "auth/a" },
    { tokenEmail: "invalid" },
    { tokenEmailVerified: false },
    { authUser: { ...authUser, uid: "other" } },
    { authUser: { ...authUser, emailVerified: false } },
    { authUser: { ...authUser, disabled: true } },
    { authUser: { ...authUser, customClaims: { companyId: "company/a" } } },
    {
      tokenCompanyId: "company-a",
      authUser: { ...authUser, customClaims: {} },
    },
    { tokenIsSuperUser: "true" },
    { authUser: { ...authUser, customClaims: { isSuperUser: "true" } } },
  ]) {
    policyError(
      () => identity(overrides),
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
});

test("reservation requires an exact safe pointer owned by the Auth UID", () => {
  assert.deepEqual(
    resolveInitialAdminReservation({
      reservation: { companyId: "company-a", userId: "auth-a" },
      uid: "auth-a",
    }),
    { companyId: "company-a", userId: "auth-a" },
  );
  for (const reservation of [
    null,
    { companyId: "company-a" },
    { companyId: "company/a", userId: "auth-a" },
    { companyId: "company-a", userId: "auth-a", extra: true },
  ]) {
    policyError(
      () => resolveInitialAdminReservation({ reservation, uid: "auth-a" }),
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.RESERVATION_INVALID,
    );
  }
  policyError(
    () =>
      resolveInitialAdminReservation({
        reservation: { companyId: "company-a", userId: "other" },
        uid: "auth-a",
      }),
    INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.RESERVATION_CONFLICT,
  );
});

test("retry state requires the reserved admin User and Company", () => {
  const resolvedIdentity = identity({
    authUser: {
      ...authUser,
      customClaims: { companyId: "company-a" },
    },
  });
  const reservation = { companyId: "company-a", userId: "auth-a" };
  assert.doesNotThrow(() =>
    assertInitialAdminRetryState({
      identity: resolvedIdentity,
      reservation,
      user: {
        companyId: "company-a",
        email: "admin@example.com",
        isAdmin: true,
        isTemporary: false,
        disabled: false,
      },
      company: { companyName: "警備会社", companyNameKana: "ケイビ" },
    }),
  );
  for (const overrides of [
    { user: null },
    { user: { companyId: "company-b" } },
    { reservation: { companyId: "company-a", userId: "other" } },
    {
      reservation: {
        companyId: "company-a",
        userId: "auth-a",
        extra: true,
      },
    },
    { company: null },
    { company: { companyName: "", companyNameKana: "ケイビ" } },
    { company: { companyName: " 警備会社", companyNameKana: "ケイビ" } },
    { company: { companyName: "a".repeat(21), companyNameKana: "ケイビ" } },
    {
      company: {
        companyName: "警備会社",
        companyNameKana: "a".repeat(41),
      },
    },
  ]) {
    policyError(
      () =>
        assertInitialAdminRetryState({
          identity: resolvedIdentity,
          reservation,
          user: {
            companyId: "company-a",
            email: "admin@example.com",
            isAdmin: true,
            isTemporary: false,
            disabled: false,
          },
          company: { companyName: "警備会社", companyNameKana: "ケイビ" },
          ...overrides,
        }),
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.EXISTING_STATE_INVALID,
    );
  }
});
