import assert from "node:assert/strict";
import test from "node:test";

import {
  mapUserAccountSetupError,
} from "../../functions/modules/auth/mappers/mapUserAccountSetupError.js";
import {
  USER_ACCOUNT_SETUP_ERROR_CODES,
  UserAccountSetupError,
} from "../../functions/modules/auth/setupUserAccount.js";
import {
  USER_ACCOUNT_SETUP_POLICY_ERROR_CODES,
  UserAccountSetupPolicyError,
} from "../../functions/modules/auth/policies/userAccountSetupPolicy.js";

const SENSITIVE_INTERNAL_MESSAGE =
  "internal uid=user-secret companyId=company-secret";

function assertSafeResponse(response, expectedCode, expectedMessage) {
  assert.deepEqual(response, {
    code: expectedCode,
    message: expectedMessage,
  });
  assert.equal(response.message.includes("user-secret"), false);
  assert.equal(response.message.includes("company-secret"), false);
}

test("missing or invalid Auth identity maps to a generic precondition", () => {
  const errors = [
    new UserAccountSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.REQUIRED_FIELD_MISSING,
      SENSITIVE_INTERNAL_MESSAGE,
    ),
    ...[
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_UID_INVALID,
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_EMAIL_INVALID,
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_VERIFIED_STATE_INVALID,
    ].map(
      (code) => new UserAccountSetupPolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
    ),
  ];
  for (const error of errors) {
    assertSafeResponse(
      mapUserAccountSetupError(error),
      "failed-precondition",
      "認証情報を確認できません。",
    );
  }
});

test("existing registered User maps to already-exists", () => {
  assertSafeResponse(
    mapUserAccountSetupError(
      new UserAccountSetupError(
        USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "already-exists",
    "ユーザーアカウントは既に本登録されています。",
  );
});

test("missing reservation or reserved User maps to not-found", () => {
  for (const code of [
    USER_ACCOUNT_SETUP_ERROR_CODES.EMAIL_RESERVATION_NOT_FOUND,
    USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_NOT_FOUND,
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(
        new UserAccountSetupError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "not-found",
      "事前登録が見つかりません。",
    );
  }
});

test("missing UID and email are classified as invalid Auth identity", () => {
  for (const error of [
    new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_UID_INVALID,
      SENSITIVE_INTERNAL_MESSAGE,
    ),
    new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_EMAIL_INVALID,
      SENSITIVE_INTERNAL_MESSAGE,
    ),
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(error),
      "failed-precondition",
      "認証情報を確認できません。",
    );
  }
});

test("Employee reservation failures map to a generic precondition", () => {
  for (const code of [
    USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_NOT_FOUND,
    USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_INVALID,
    USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_MISMATCH,
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(
        new UserAccountSetupError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "failed-precondition",
      "事前登録情報を確認できません。",
    );
  }
});

test("invalid services and unknown setup errors map to internal", () => {
  for (const code of [
    USER_ACCOUNT_SETUP_ERROR_CODES.AUTH_SERVICE_INVALID,
    USER_ACCOUNT_SETUP_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
    "unknown-setup-error",
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(
        new UserAccountSetupError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "internal",
      "ユーザーアカウント作成中に予期しないエラーが発生しました。",
    );
  }
});

test("unverified email returns corrective guidance", () => {
  assertSafeResponse(
    mapUserAccountSetupError(
      new UserAccountSetupPolicyError(
        USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "メールアドレスの確認を完了してください。",
  );
});

test("missing pre-registration maps to not-found", () => {
  assertSafeResponse(
    mapUserAccountSetupError(
      new UserAccountSetupPolicyError(
        USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_FOUND,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "not-found",
    "事前登録が見つかりません。",
  );
});

test("invalid pre-registration states map without exposing details", () => {
  for (const code of [
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_UNIQUE,
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.RESERVATION_STATE_INVALID,
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_COMPANY_MISMATCH,
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_EMAIL_MISMATCH,
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_TEMPORARY,
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(
        new UserAccountSetupPolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "failed-precondition",
      "事前登録情報を確認できません。",
    );
  }
});

test("Firestore transaction exhaustion maps to an actionable retry", () => {
  for (const code of [10, "10", "aborted"]) {
    assertSafeResponse(
      mapUserAccountSetupError({ code, message: SENSITIVE_INTERNAL_MESSAGE }),
      "aborted",
      "同時更新が発生しました。状態を更新してから再試行してください。",
    );
  }
});

test("missing policy inputs and unknown policy errors map to internal", () => {
  for (const code of [
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    "unknown-policy-error",
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(
        new UserAccountSetupPolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "internal",
      "ユーザーアカウント作成中に予期しないエラーが発生しました。",
    );
  }
});

test("unknown errors and forged callable codes map to internal", () => {
  for (const error of [
    new Error(SENSITIVE_INTERNAL_MESSAGE),
    {
      code: "permission-denied",
      message: SENSITIVE_INTERNAL_MESSAGE,
    },
    null,
    undefined,
  ]) {
    assertSafeResponse(
      mapUserAccountSetupError(error),
      "internal",
      "ユーザーアカウント作成中に予期しないエラーが発生しました。",
    );
  }
});
