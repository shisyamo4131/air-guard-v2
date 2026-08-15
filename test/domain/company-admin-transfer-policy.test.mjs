import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCompanyAdminTransferPolicy,
  COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES,
  CompanyAdminTransferPolicyError,
} from "../../functions/modules/auth/companyAdminTransferPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/userAuthCompanyPolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "admin-a";
const TARGET_UID = "user-a";

function createSourceUser(overrides = {}) {
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
    fromUid: ACTOR_UID,
    fromUser: createSourceUser(),
    toUid: TARGET_UID,
    toUser: createTargetUser(),
    currentAdminUids: [ACTOR_UID],
    ...overrides,
  };
}

function assertTransferPolicyError(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof CompanyAdminTransferPolicyError);
    assert.equal(error.name, "CompanyAdminTransferPolicyError");
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

test("company admin transfer policy error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new CompanyAdminTransferPolicyError(
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "CompanyAdminTransferPolicyError");
  assert.equal(
    error.code,
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH,
  );
  assert.equal(error.cause, cause);
});

test("company admin transfer policy error codes are frozen", () => {
  assert.equal(
    Object.isFrozen(COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES),
    true,
  );
});

test("active sole company administrator may transfer to an active regular User", () => {
  assert.doesNotThrow(() =>
    assertCompanyAdminTransferPolicy(createPolicyInput()),
  );
});

test("policy validation does not mutate its inputs", () => {
  const input = createPolicyInput();
  const before = structuredClone(input);

  assertCompanyAdminTransferPolicy(input);

  assert.deepEqual(input, before);
});

test("all required policy inputs must be present and structurally valid", () => {
  assertTransferPolicyError(
    () => assertCompanyAdminTransferPolicy(),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ currentAdminUids: "admin-a" }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});

test("caller cannot nominate another User as the source administrator", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ actorUid: "user-b" }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH,
  );
});

test("administrator cannot transfer authority to the same User", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ toUid: ACTOR_UID }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_TARGET_SAME,
  );
});

test("source administrator from another company is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({
          fromUser: createSourceUser({ companyId: "company-b" }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );
});

test("temporary source administrator is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({
          fromUser: createSourceUser({ isTemporary: true }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
  );
});

test("source administrator with a missing registered state is rejected", () => {
  const fromUser = createSourceUser();
  delete fromUser.isTemporary;

  assertCompanyPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(createPolicyInput({ fromUser })),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  );
});

test("target User from another company is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({
          toUser: createTargetUser({ companyId: "company-b" }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );
});

test("temporary target User is rejected", () => {
  assertCompanyPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({
          toUser: createTargetUser({ isTemporary: true }),
        }),
      ),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
  );
});

test("target User with a missing registered state is rejected", () => {
  const toUser = createTargetUser();
  delete toUser.isTemporary;

  assertCompanyPolicyError(
    () => assertCompanyAdminTransferPolicy(createPolicyInput({ toUser })),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  );
});

test("company without an administrator is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ currentAdminUids: [] }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.CURRENT_ADMIN_COUNT_INVALID,
  );
});

test("company with multiple administrators is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ currentAdminUids: [ACTOR_UID, "admin-b"] }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.CURRENT_ADMIN_COUNT_INVALID,
  );
});

test("sole administrator other than the actor is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ currentAdminUids: ["admin-b"] }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_NOT_CURRENT_ADMIN,
  );
});

test("source User with an invalid admin state is rejected", () => {
  const fromUser = createSourceUser();
  delete fromUser.isAdmin;

  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(createPolicyInput({ fromUser })),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_ADMIN_STATE_INVALID,
  );
});

test("regular source User is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ fromUser: createSourceUser({ isAdmin: false }) }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ADMIN,
  );
});

test("source administrator with an invalid disabled state is rejected", () => {
  const fromUser = createSourceUser();
  delete fromUser.disabled;

  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(createPolicyInput({ fromUser })),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_DISABLED_STATE_INVALID,
  );
});

test("disabled source administrator is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ fromUser: createSourceUser({ disabled: true }) }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ACTIVE,
  );
});

test("target User with an invalid admin state is rejected", () => {
  const toUser = createTargetUser();
  delete toUser.isAdmin;

  assertTransferPolicyError(
    () => assertCompanyAdminTransferPolicy(createPolicyInput({ toUser })),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
  );
});

test("existing administrator target is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ toUser: createTargetUser({ isAdmin: true }) }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ALREADY_ADMIN,
  );
});

test("target User with an invalid disabled state is rejected", () => {
  const toUser = createTargetUser();
  delete toUser.disabled;

  assertTransferPolicyError(
    () => assertCompanyAdminTransferPolicy(createPolicyInput({ toUser })),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID,
  );
});

test("disabled target User is rejected", () => {
  assertTransferPolicyError(
    () =>
      assertCompanyAdminTransferPolicy(
        createPolicyInput({ toUser: createTargetUser({ disabled: true }) }),
      ),
    COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE,
  );
});
