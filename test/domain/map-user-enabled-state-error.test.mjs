import assert from "node:assert/strict";
import test from "node:test";

import {
  mapUserEnabledStateError,
} from "../../functions/modules/auth/mappers/mapUserEnabledStateError.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/policies/userAuthCompanyPolicy.js";
import {
  USER_ENABLED_STATE_CHANGE_ERROR_CODES,
  UserEnabledStateChangeError,
} from "../../functions/modules/auth/changeUserEnabledState.js";
import {
  USER_ENABLED_STATE_POLICY_ERROR_CODES,
  UserEnabledStatePolicyError,
} from "../../functions/modules/auth/policies/userEnabledStatePolicy.js";
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "../../functions/modules/auth/resolveCallableAuthIdentity.js";

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

test("invalid change inputs map to invalid-argument", () => {
  for (const code of [
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.REQUIRED_FIELD_MISSING,
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.ENABLED_STATE_INVALID,
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.EXPECTED_DISABLED_STATE_INVALID,
  ]) {
    const response = mapUserEnabledStateError(
      new UserEnabledStateChangeError(code, SENSITIVE_INTERNAL_MESSAGE),
    );

    assertSafeResponse(
      response,
      "invalid-argument",
      "必要な情報が不足しているか、形式が正しくありません。",
    );
  }
});

test("missing actor and target map without exposing identifiers", () => {
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStateChangeError(
        USER_ENABLED_STATE_CHANGE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "操作するユーザー情報を確認できません。",
  );

  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStateChangeError(
        USER_ENABLED_STATE_CHANGE_ERROR_CODES.TARGET_USER_NOT_FOUND,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "not-found",
    "対象ユーザーが見つかりません。",
  );
});

test("common Callable Auth identity errors use the shared safe response", () => {
  for (const code of [
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new CallableAuthIdentityError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "permission-denied",
      "この操作を行う権限がありません。",
    );
  }
});

test("invalid services and unknown change errors map to internal", () => {
  for (const code of [
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.AUTH_SERVICE_INVALID,
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
    "unknown-change-error",
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new UserEnabledStateChangeError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "internal",
      "ユーザーの状態変更中に予期しないエラーが発生しました。",
    );
  }
});

test("concurrent state and lifecycle conflicts map to aborted", () => {
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStatePolicyError(
        USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_STALE,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "aborted",
    "対象ユーザーの有効状態が別の操作で変更されました。最新状態を確認して再実行してください。",
  );
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStateChangeError(
        USER_ENABLED_STATE_CHANGE_ERROR_CODES.TARGET_LIFECYCLE_OPERATION_ACTIVE,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "aborted",
    "対象ユーザーの退職または削除処理中です。処理完了後に最新状態を確認してください。",
  );
});

test("unauthorized actors map to permission-denied", () => {
  for (const code of [
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN,
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new UserEnabledStatePolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "permission-denied",
      "この操作を行う権限がありません。",
    );
  }
});

test("self status change returns a corrective precondition response", () => {
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStatePolicyError(
        USER_ENABLED_STATE_POLICY_ERROR_CODES.SELF_STATUS_CHANGE_FORBIDDEN,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "自分自身を有効化または無効化することはできません。",
  );
});

test("administrator target returns the transfer guidance", () => {
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStatePolicyError(
        USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "会社管理者を有効化または無効化することはできません。先に管理者権限を移譲してください。",
  );
});

test("invalid User states map to a generic precondition response", () => {
  for (const code of [
    USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
    USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
    USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID,
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new UserEnabledStatePolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "failed-precondition",
      "ユーザーの状態を確認できません。",
    );
  }
});

test("unknown enabled state policy errors map to internal", () => {
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserEnabledStatePolicyError(
        "unknown-policy-error",
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "internal",
    "ユーザーの状態変更中に予期しないエラーが発生しました。",
  );
});

test("company and identity mismatches map to permission-denied", () => {
  for (const code of [
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH,
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new UserAuthCompanyPolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "permission-denied",
      "この操作を行う権限がありません。",
    );
  }
});

test("missing Auth company maps to a generic authentication precondition", () => {
  assertSafeResponse(
    mapUserEnabledStateError(
      new UserAuthCompanyPolicyError(
        USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING,
        SENSITIVE_INTERNAL_MESSAGE,
      ),
    ),
    "failed-precondition",
    "対象ユーザーの認証情報を確認できません。",
  );
});

test("temporary and invalid registration states map to a generic precondition", () => {
  for (const code of [
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new UserAuthCompanyPolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "failed-precondition",
      "対象ユーザーはこの操作を行える状態ではありません。",
    );
  }
});

test("missing company policy inputs and unknown policy errors map to internal", () => {
  for (const code of [
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    "unknown-company-policy-error",
  ]) {
    assertSafeResponse(
      mapUserEnabledStateError(
        new UserAuthCompanyPolicyError(code, SENSITIVE_INTERNAL_MESSAGE),
      ),
      "internal",
      "ユーザーの状態変更中に予期しないエラーが発生しました。",
    );
  }
});

test("Firebase Auth user-not-found maps to not-found", () => {
  assertSafeResponse(
    mapUserEnabledStateError({
      code: "auth/user-not-found",
      message: SENSITIVE_INTERNAL_MESSAGE,
    }),
    "not-found",
    "対象ユーザーが見つかりません。",
  );
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
      mapUserEnabledStateError(error),
      "internal",
      "ユーザーの状態変更中に予期しないエラーが発生しました。",
    );
  }
});
