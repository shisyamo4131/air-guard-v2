import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE_TEMPORARY_USER_ERROR_CODES,
  DeleteTemporaryUserError,
} from "../../functions/modules/auth/deleteTemporaryUser.js";
import {
  mapDeleteTemporaryUserError,
} from "../../functions/modules/auth/mapDeleteTemporaryUserError.js";
import {
  TEMPORARY_USER_DELETION_POLICY_ERROR_CODES,
  TemporaryUserDeletionPolicyError,
} from "../../functions/modules/auth/temporaryUserDeletionPolicy.js";
import {
  TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES,
  TemporaryUserManagementPolicyError,
} from "../../functions/modules/auth/temporaryUserManagementPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/userAuthCompanyPolicy.js";
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "../../functions/modules/auth/resolveCallableAuthIdentity.js";

const INVALID_ARGUMENT_RESPONSE = {
  code: "invalid-argument",
  message: "必要な情報が不足しているか、形式が正しくありません。",
};
const PERMISSION_DENIED_RESPONSE = {
  code: "permission-denied",
  message: "この操作を行う権限がありません。",
};
const ACTOR_STATE_RESPONSE = {
  code: "failed-precondition",
  message: "操作するユーザー情報を確認できません。",
};
const TARGET_STATE_RESPONSE = {
  code: "failed-precondition",
  message: "対象ユーザーは削除できる仮登録状態ではありません。",
};
const INTERNAL_RESPONSE = {
  code: "internal",
  message: "仮登録ユーザーの削除中に予期しないエラーが発生しました。",
};

test("use-case input and lookup errors are mapped", () => {
  for (const code of [
    DELETE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING,
    DELETE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID,
  ]) {
    assert.deepEqual(
      mapDeleteTemporaryUserError(new DeleteTemporaryUserError(code, "secret")),
      INVALID_ARGUMENT_RESPONSE,
    );
  }

  assert.deepEqual(
    mapDeleteTemporaryUserError(
      new DeleteTemporaryUserError(
        DELETE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
        "secret",
      ),
    ),
    ACTOR_STATE_RESPONSE,
  );
  assert.deepEqual(
    mapDeleteTemporaryUserError(
      new DeleteTemporaryUserError(
        DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_USER_NOT_FOUND,
        "secret",
      ),
    ),
    { code: "not-found", message: "対象ユーザーが見つかりません。" },
  );
});

test("actor permission failures do not expose internal details", () => {
  for (const code of [
    TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
    TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
  ]) {
    assert.deepEqual(
      mapDeleteTemporaryUserError(
        new TemporaryUserManagementPolicyError(code, "company-a actor-a"),
      ),
      PERMISSION_DENIED_RESPONSE,
    );
  }

  assert.deepEqual(
    mapDeleteTemporaryUserError(
      new UserAuthCompanyPolicyError(
        USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
        "company-a actor-a",
      ),
    ),
    PERMISSION_DENIED_RESPONSE,
  );
});

test("malformed actor state is mapped to a safe precondition error", () => {
  for (const code of [
    TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
    TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ADMIN_STATE_INVALID,
    TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
  ]) {
    assert.deepEqual(
      mapDeleteTemporaryUserError(
        new TemporaryUserManagementPolicyError(code, "secret"),
      ),
      ACTOR_STATE_RESPONSE,
    );
  }

  for (const code of [
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  ]) {
    assert.deepEqual(
      mapDeleteTemporaryUserError(
        new UserAuthCompanyPolicyError(code, "secret"),
      ),
      ACTOR_STATE_RESPONSE,
    );
  }
});

test("target policy failures are mapped to one safe response", () => {
  for (const code of Object.values(
    TEMPORARY_USER_DELETION_POLICY_ERROR_CODES,
  )) {
    assert.deepEqual(
      mapDeleteTemporaryUserError(
        new TemporaryUserDeletionPolicyError(code, "company-a target-a"),
      ),
      TARGET_STATE_RESPONSE,
    );
  }
});

test("shared Callable identity errors retain the shared mapping", () => {
  assert.deepEqual(
    mapDeleteTemporaryUserError(
      new CallableAuthIdentityError(
        CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
        "secret",
      ),
    ),
    PERMISSION_DENIED_RESPONSE,
  );
});

test("service, unknown typed, and unexpected errors fail closed", () => {
  for (const error of [
    new DeleteTemporaryUserError(
      DELETE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "secret",
    ),
    new DeleteTemporaryUserError("future-code", "secret"),
    new TemporaryUserManagementPolicyError("future-code", "secret"),
    new TemporaryUserDeletionPolicyError("future-code", "secret"),
    new UserAuthCompanyPolicyError("future-code", "secret"),
    new Error("secret"),
  ]) {
    assert.deepEqual(mapDeleteTemporaryUserError(error), INTERNAL_RESPONSE);
  }
});
