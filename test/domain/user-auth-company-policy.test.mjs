import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAuthUserCompany,
  assertUserDocumentCompany,
  hasAuthRelevantChanges,
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/policies/userAuthCompanyPolicy.js";

const COMPANY_ID = "company-a";
const USER_ID = "user-a";

function assertPolicyError(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof UserAuthCompanyPolicyError);
    assert.equal(error.name, "UserAuthCompanyPolicyError");
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("policy error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new UserAuthCompanyPolicyError(
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "UserAuthCompanyPolicyError");
  assert.equal(
    error.code,
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );
  assert.equal(error.cause, cause);
});

test("policy error codes are frozen", () => {
  assert.equal(Object.isFrozen(USER_AUTH_COMPANY_POLICY_ERROR_CODES), true);
});

test("registered User document with matching company passes", () => {
  assert.doesNotThrow(() =>
    assertUserDocumentCompany({
      pathCompanyId: COMPANY_ID,
      userData: {
        companyId: COMPANY_ID,
        isTemporary: false,
      },
    }),
  );
});

test("User document requires a path company and user data", () => {
  assertPolicyError(
    () => assertUserDocumentCompany(),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertPolicyError(
    () =>
      assertUserDocumentCompany({
        pathCompanyId: COMPANY_ID,
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});

test("User document from another company is rejected", () => {
  assertPolicyError(
    () =>
      assertUserDocumentCompany({
        pathCompanyId: COMPANY_ID,
        userData: {
          companyId: "company-b",
          isTemporary: false,
        },
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );
});

test("temporary User document is excluded from Auth operations", () => {
  assertPolicyError(
    () =>
      assertUserDocumentCompany({
        pathCompanyId: COMPANY_ID,
        userData: {
          companyId: COMPANY_ID,
          isTemporary: true,
        },
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
  );
});

test("User document with a missing temporary state fails closed", () => {
  assertPolicyError(
    () =>
      assertUserDocumentCompany({
        pathCompanyId: COMPANY_ID,
        userData: {
          companyId: COMPANY_ID,
        },
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  );
});

test("target Auth account with matching UID and company passes", () => {
  assert.doesNotThrow(() =>
    assertAuthUserCompany({
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      authUser: {
        uid: USER_ID,
        customClaims: {
          companyId: COMPANY_ID,
          isSuperUser: false,
        },
      },
    }),
  );
});

test("target Auth account requires all inputs", () => {
  assertPolicyError(
    () => assertAuthUserCompany(),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertPolicyError(
    () =>
      assertAuthUserCompany({
        pathCompanyId: COMPANY_ID,
        docId: USER_ID,
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});

test("target Auth account with a missing company claim is rejected", () => {
  assertPolicyError(
    () =>
      assertAuthUserCompany({
        pathCompanyId: COMPANY_ID,
        docId: USER_ID,
        authUser: {
          uid: USER_ID,
        },
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING,
  );
});

test("target Auth account from another company is rejected", () => {
  assertPolicyError(
    () =>
      assertAuthUserCompany({
        pathCompanyId: COMPANY_ID,
        docId: USER_ID,
        authUser: {
          uid: USER_ID,
          customClaims: {
            companyId: "company-b",
            isSuperUser: false,
          },
        },
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
  );
});

test("target Auth account with another UID is rejected", () => {
  assertPolicyError(
    () =>
      assertAuthUserCompany({
        pathCompanyId: COMPANY_ID,
        docId: USER_ID,
        authUser: {
          uid: "user-b",
          customClaims: {
            companyId: COMPANY_ID,
            isSuperUser: false,
          },
        },
      }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH,
  );
});

test("target Auth account requires a boolean super-user claim", () => {
  for (const isSuperUser of [undefined, null, "false", 0]) {
    assertPolicyError(
      () =>
        assertAuthUserCompany({
          pathCompanyId: COMPANY_ID,
          docId: USER_ID,
          authUser: {
            uid: USER_ID,
            customClaims: {
              companyId: COMPANY_ID,
              ...(isSuperUser === undefined ? {} : { isSuperUser }),
            },
          },
        }),
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_SUPER_USER_CLAIM_INVALID,
    );
  }
});

test("target Auth account accepts both boolean super-user states", () => {
  for (const isSuperUser of [false, true]) {
    assert.doesNotThrow(() =>
      assertAuthUserCompany({
        pathCompanyId: COMPANY_ID,
        docId: USER_ID,
        authUser: {
          uid: USER_ID,
          customClaims: {
            companyId: COMPANY_ID,
            isSuperUser,
          },
        },
      }),
    );
  }
});

test("displayName or disabled changes require an Auth update", () => {
  assert.equal(
    hasAuthRelevantChanges({
      beforeData: { displayName: "Before", disabled: false },
      afterData: { displayName: "After", disabled: false },
    }),
    true,
  );
  assert.equal(
    hasAuthRelevantChanges({
      beforeData: { displayName: "Before", disabled: false },
      afterData: { displayName: "Before", disabled: true },
    }),
    true,
  );
});

test("unrelated changes do not require an Auth update", () => {
  assert.equal(
    hasAuthRelevantChanges({
      beforeData: {
        displayName: "Same",
        disabled: false,
        tagSize: "small",
      },
      afterData: {
        displayName: "Same",
        disabled: false,
        tagSize: "large",
      },
    }),
    false,
  );
});

test("Auth change detection requires before and after data", () => {
  assertPolicyError(
    () => hasAuthRelevantChanges(),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertPolicyError(
    () => hasAuthRelevantChanges({ beforeData: {} }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});
