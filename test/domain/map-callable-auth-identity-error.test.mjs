import assert from "node:assert/strict";
import test from "node:test";

import {
  mapCallableAuthIdentityError,
} from "../../functions/modules/auth/mapCallableAuthIdentityError.js";
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "../../functions/modules/auth/resolveCallableAuthIdentity.js";

const SENSITIVE_MESSAGE =
  "internal uid=user-secret companyId=company-secret";

function createError(code) {
  return new CallableAuthIdentityError(code, SENSITIVE_MESSAGE);
}

function assertSafeResponse(response, expectedCode, expectedMessage) {
  assert.deepEqual(response, {
    code: expectedCode,
    message: expectedMessage,
  });
  assert.equal(response.message.includes("user-secret"), false);
  assert.equal(response.message.includes("company-secret"), false);
}

test("actor identity and active-state failures map to permission-denied", () => {
  for (const code of [
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
  ]) {
    assertSafeResponse(
      mapCallableAuthIdentityError(createError(code)),
      "permission-denied",
      "この操作を行う権限がありません。",
    );
  }
});

test("invalid Auth service and unknown typed errors map to internal", () => {
  for (const code of [
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_SERVICE_INVALID,
    "unknown-callable-auth-identity-error",
  ]) {
    assertSafeResponse(
      mapCallableAuthIdentityError(createError(code)),
      "internal",
      "認証情報の確認中に予期しないエラーが発生しました。",
    );
  }
});

test("errors outside the common Auth identity boundary are not consumed", () => {
  for (const error of [
    new Error(SENSITIVE_MESSAGE),
    { code: "permission-denied", message: SENSITIVE_MESSAGE },
    null,
    undefined,
  ]) {
    assert.equal(mapCallableAuthIdentityError(error), null);
  }
});
