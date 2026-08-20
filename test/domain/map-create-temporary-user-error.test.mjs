import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATE_TEMPORARY_USER_ERROR_CODES,
  CreateTemporaryUserError,
} from "../../functions/modules/auth/createTemporaryUser.js";
import { mapCreateTemporaryUserError } from "../../functions/modules/auth/mapCreateTemporaryUserError.js";
import {
  TEMPORARY_USER_CREATION_POLICY_ERROR_CODES,
  TemporaryUserCreationPolicyError,
} from "../../functions/modules/auth/temporaryUserCreationPolicy.js";
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

const FIXTURE_SECRET = "user@example.com/company-a/actor-a";

function assertMapping(error, code, messagePattern) {
  const result = mapCreateTemporaryUserError(error);
  assert.equal(result.code, code);
  assert.match(result.message, messagePattern);
  assert.equal(result.message.includes(FIXTURE_SECRET), false);
}

test("creation use-case errors map to stable public responses", () => {
  const cases = [
    ["REQUIRED_FIELD_MISSING", "invalid-argument", /形式/],
    ["IDENTIFIER_INVALID", "invalid-argument", /形式/],
    ["AUTH_EMAIL_INVALID", "invalid-argument", /形式/],
    ["ACTOR_USER_NOT_FOUND", "failed-precondition", /ユーザー情報/],
    ["AUTH_EMAIL_ALREADY_EXISTS", "already-exists", /メールアドレス/],
    ["EMAIL_RESERVATION_EXISTS", "already-exists", /メールアドレス/],
    ["EMAIL_USER_EXISTS", "already-exists", /メールアドレス/],
    ["EMPLOYEE_NOT_FOUND", "not-found", /従業員/],
    ["EMPLOYEE_RESERVATION_EXISTS", "already-exists", /紐づいて/],
    ["EMPLOYEE_USER_EXISTS", "already-exists", /紐づいて/],
    ["AUTH_SERVICE_INVALID", "internal", /予期しない/],
    ["FIRESTORE_SERVICE_INVALID", "internal", /予期しない/],
  ];

  for (const [key, code, messagePattern] of cases) {
    assertMapping(
      new CreateTemporaryUserError(
        CREATE_TEMPORARY_USER_ERROR_CODES[key],
        FIXTURE_SECRET,
      ),
      code,
      messagePattern,
    );
  }
});

test("creation policy errors separate input and Employee state", () => {
  const employeeCodes = ["EMPLOYEE_INVALID", "EMPLOYEE_NOT_ACTIVE"];
  for (const key of employeeCodes) {
    assertMapping(
      new TemporaryUserCreationPolicyError(
        TEMPORARY_USER_CREATION_POLICY_ERROR_CODES[key],
        FIXTURE_SECRET,
      ),
      "failed-precondition",
      /連携できる状態/,
    );
  }

  for (const [key, value] of Object.entries(
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES,
  )) {
    if (employeeCodes.includes(key)) continue;
    assertMapping(
      new TemporaryUserCreationPolicyError(value, FIXTURE_SECRET),
      "invalid-argument",
      /形式/,
    );
  }
});

test("actor policy errors distinguish permission and malformed state", () => {
  for (const key of ["ACTOR_NOT_ACTIVE", "ACTOR_PERMISSION_DENIED"]) {
    assertMapping(
      new TemporaryUserManagementPolicyError(
        TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES[key],
        FIXTURE_SECRET,
      ),
      "permission-denied",
      /権限/,
    );
  }

  for (const key of [
    "REQUIRED_FIELD_MISSING",
    "ACTOR_DISABLED_STATE_INVALID",
    "ACTOR_ADMIN_STATE_INVALID",
    "ACTOR_ROLES_INVALID",
  ]) {
    assertMapping(
      new TemporaryUserManagementPolicyError(
        TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES[key],
        FIXTURE_SECRET,
      ),
      "failed-precondition",
      /ユーザー情報/,
    );
  }
});

test("company policy errors distinguish tenant denial and actor state", () => {
  assertMapping(
    new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
      FIXTURE_SECRET,
    ),
    "permission-denied",
    /権限/,
  );

  for (const key of [
    "REQUIRED_FIELD_MISSING",
    "USER_IS_TEMPORARY",
    "USER_TEMPORARY_STATE_INVALID",
  ]) {
    assertMapping(
      new UserAuthCompanyPolicyError(
        USER_AUTH_COMPANY_POLICY_ERROR_CODES[key],
        FIXTURE_SECRET,
      ),
      "failed-precondition",
      /ユーザー情報/,
    );
  }
});

test("callable Auth identity errors delegate to the shared mapper", () => {
  assertMapping(
    new CallableAuthIdentityError(
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
      FIXTURE_SECRET,
    ),
    "permission-denied",
    /権限/,
  );
});

test("Firestore aborted errors are retryable but unknown errors stay internal", () => {
  for (const code of [10, "10", "aborted"]) {
    assertMapping({ code, message: FIXTURE_SECRET }, "aborted", /同時更新/);
  }

  for (const error of [
    new Error(FIXTURE_SECRET),
    { code: "already-exists", message: FIXTURE_SECRET },
    new CreateTemporaryUserError("unknown", FIXTURE_SECRET),
    null,
  ]) {
    assertMapping(error, "internal", /予期しない/);
  }
});
