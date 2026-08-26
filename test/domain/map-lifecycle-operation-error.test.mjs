import assert from "node:assert/strict";
import test from "node:test";

import {
  LIFECYCLE_DOMAIN_ERROR_CODES,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";
import {
  LIFECYCLE_OPERATION_STORE_ERROR_CODES,
  LifecycleOperationStoreError,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationStore.js";
import { mapLifecycleOperationError } from "../../functions/modules/auth/mappers/mapLifecycleOperationError.js";
import {
  USER_LIFECYCLE_POLICY_ERROR_CODES,
  UserLifecyclePolicyError,
} from "../../functions/modules/auth/policies/userLifecyclePolicy.js";
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "../../functions/modules/auth/resolveCallableAuthIdentity.js";

test("lifecycle mapper exposes the approved stable domain code contract", () => {
  const expectations = new Map([
    [LIFECYCLE_DOMAIN_ERROR_CODES.UNAUTHENTICATED, "unauthenticated"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.INVALID_INPUT, "invalid-argument"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.ACTOR_NOT_ALLOWED, "permission-denied"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_NOT_FOUND, "not-found"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND, "not-found"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.OPERATION_ID_CONFLICT, "already-exists"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.SELF_OPERATION_DENIED, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_STATE_INVALID, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.ADMIN_TARGET_DENIED, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.SUPER_USER_TARGET_DENIED, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.TEMPORARY_USER_LINKED, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_NOT_COMPLETED, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.ALREADY_REINSTATED, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.LATEST_OPERATION_MISMATCH, "failed-precondition"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_OPERATION_ACTIVE, "aborted"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE, "unavailable"],
    [LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL, "internal"],
  ]);

  for (const [domainCode, expectedCode] of expectations) {
    assert.equal(mapLifecycleOperationError({ domainCode }).code, expectedCode);
  }
});
test("lifecycle mapper distinguishes invalid input, actor denial, and target state", () => {
  assert.equal(
    mapLifecycleOperationError(
      new UserLifecyclePolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
        "private unexpected field detail",
      ),
    ).code,
    "invalid-argument",
  );
  assert.equal(
    mapLifecycleOperationError(
      new UserLifecyclePolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
        "private actor detail",
      ),
    ).code,
    "permission-denied",
  );
  assert.equal(
    mapLifecycleOperationError(
      new UserLifecyclePolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_STATE_INVALID,
        "private employee detail",
      ),
    ).code,
    "failed-precondition",
  );
});

test("lifecycle mapper uses failed-precondition for invalid current Auth identity", () => {
  for (const code of [
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
  ]) {
    assert.deepEqual(
      mapLifecycleOperationError(
        new CallableAuthIdentityError(code, "private identity detail"),
      ),
      {
        code: "failed-precondition",
        message: "認証情報を確認できないため処理を続行できません。",
      },
    );
  }
});

test("lifecycle mapper maps store conflicts and fails closed for unknown errors", () => {
  assert.equal(
    mapLifecycleOperationError(
      new LifecycleOperationStoreError(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_ID_CONFLICT,
        "private conflict detail",
      ),
    ).code,
    "already-exists",
  );
  assert.equal(
    mapLifecycleOperationError(
      new LifecycleOperationStoreError(
        LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE,
        "private active detail",
      ),
    ).code,
    "aborted",
  );
  assert.deepEqual(mapLifecycleOperationError(new Error("private")), {
    code: "internal",
    message: "処理中に予期しないエラーが発生しました。",
  });
});

test("lifecycle mapper never exposes private source messages", () => {
  const privateValues = [
    "employee-private-id",
    "user-private@example.invalid",
    "退職理由の原文",
  ];
  for (const privateValue of privateValues) {
    const response = mapLifecycleOperationError(
      new UserLifecyclePolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_STATE_INVALID,
        privateValue,
      ),
    );
    assert.equal(JSON.stringify(response).includes(privateValue), false);
  }
});
