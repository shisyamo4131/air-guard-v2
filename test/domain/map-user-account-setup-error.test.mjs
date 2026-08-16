import assert from "node:assert/strict";
import test from "node:test";

import {
  mapUserAccountSetupError,
} from "../../functions/modules/auth/mapUserAccountSetupError.js";
import {
  USER_ACCOUNT_SETUP_ERROR_CODES,
  UserAccountSetupError,
} from "../../functions/modules/auth/setupUserAccount.js";
import {
  USER_ACCOUNT_SETUP_POLICY_ERROR_CODES,
  UserAccountSetupPolicyError,
} from "../../functions/modules/auth/userAccountSetupPolicy.js";

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

test("missing Auth identity maps to a generic precondition", () => {
  assertSafeResponse(
    mapUserAccountSetupError(
      new UserAccountSetupError(
        USER_ACCOUNT_SETUP_ERROR_CODES.REQUIRED_FIELD_MISSING,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "認証情報を確認できません。",
  );
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

test("invalid verified-email state maps to a generic precondition", () => {
  assertSafeResponse(
    mapUserAccountSetupError(
      new UserAccountSetupPolicyError(
        USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_VERIFIED_STATE_INVALID,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "認証情報を確認できません。",
  );
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
