import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOMER_ARCHIVE_ERROR_CODES,
  CustomerArchiveError,
} from "../../functions/modules/customer/archiveCustomer.js";
import {
  mapCustomerArchiveError,
} from "../../functions/modules/customer/mappers/mapCustomerArchiveError.js";
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "../../functions/modules/auth/resolveCallableAuthIdentity.js";

const SENSITIVE =
  "uid=actor-secret companyId=company-secret customerId=customer-secret reason=secret raw-error";

function assertSafe(response, code, message) {
  assert.deepEqual(response, { code, message });
  assert.equal(Object.hasOwn(response, "details"), false);
  for (const value of [
    "actor-secret",
    "company-secret",
    "customer-secret",
    "reason=secret",
    "raw-error",
  ]) {
    assert.equal(response.message.includes(value), false, value);
  }
}

test("Customer archive domain errors map to fixed safe Callable errors", () => {
  const cases = [
    [CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT, "invalid-argument", "入力内容を確認してください。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED, "permission-denied", "取引先をアーカイブする権限がありません。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_NOT_FOUND, "not-found", "取引先が見つかりません。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.REFERENCES_EXIST, "failed-precondition", "参照されている取引先はアーカイブできません。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT, "aborted", "取引先のアーカイブ状態が競合しています。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "internal", "取引先をアーカイブできませんでした。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_INVALID, "internal", "取引先をアーカイブできませんでした。"],
    [CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID, "internal", "取引先をアーカイブできませんでした。"],
    ["unknown-domain-code", "internal", "取引先をアーカイブできませんでした。"],
  ];

  for (const [domainCode, callableCode, message] of cases) {
    assertSafe(
      mapCustomerArchiveError(
        new CustomerArchiveError(domainCode, SENSITIVE, {
          cause: new Error(SENSITIVE),
        }),
      ),
      callableCode,
      message,
    );
  }
});

test("common Auth identity errors are mapped before Customer domain errors", () => {
  for (const code of [
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
  ]) {
    assertSafe(
      mapCustomerArchiveError(new CallableAuthIdentityError(code, SENSITIVE)),
      "permission-denied",
      "この操作を行う権限がありません。",
    );
  }

  assertSafe(
    mapCustomerArchiveError(
      new CallableAuthIdentityError(
        CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_SERVICE_INVALID,
        SENSITIVE,
      ),
    ),
    "internal",
    "認証情報の確認中に予期しないエラーが発生しました。",
  );
});

test("unknown untyped errors fail closed without leaking raw values", () => {
  for (const error of [
    new Error(SENSITIVE),
    { code: "permission-denied", message: SENSITIVE, details: SENSITIVE },
    null,
    undefined,
  ]) {
    assertSafe(
      mapCustomerArchiveError(error),
      "internal",
      "取引先をアーカイブできませんでした。",
    );
  }
});
