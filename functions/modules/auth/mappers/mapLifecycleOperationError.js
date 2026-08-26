/*****************************************************************************
 * @file ./functions/modules/auth/mappers/mapLifecycleOperationError.js
 * @description UWB-07 lifecycle operation errorを安全なCallable応答へ変換します。
 *****************************************************************************/
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "../resolveCallableAuthIdentity.js";
import {
  LIFECYCLE_DOMAIN_ERROR_CODES,
} from "../lifecycle/lifecycleOperationSchema.js";
import {
  LIFECYCLE_OPERATION_STORE_ERROR_CODES,
  LifecycleOperationStoreError,
} from "../lifecycle/lifecycleOperationStore.js";
import {
  USER_LIFECYCLE_POLICY_ERROR_CODES,
  UserLifecyclePolicyError,
} from "../policies/userLifecyclePolicy.js";

const RESPONSES = Object.freeze({
  invalidInput: Object.freeze({
    code: "invalid-argument",
    message: "入力内容の形式が正しくありません。",
  }),
  authIdentityInvalid: Object.freeze({
    code: "failed-precondition",
    message: "認証情報を確認できないため処理を続行できません。",
  }),
  permissionDenied: Object.freeze({
    code: "permission-denied",
    message: "この操作を行う権限がありません。",
  }),
  notFound: Object.freeze({
    code: "not-found",
    message: "対象を確認できません。",
  }),
  alreadyExists: Object.freeze({
    code: "already-exists",
    message: "同じ操作IDが別の要求に使用されています。",
  }),
  failedPrecondition: Object.freeze({
    code: "failed-precondition",
    message: "現在の状態では処理を続行できません。",
  }),
  aborted: Object.freeze({
    code: "aborted",
    message: "対象に対する別の処理が進行中です。",
  }),
  unavailable: Object.freeze({
    code: "unavailable",
    message: "一時的に処理を完了できませんでした。再度お試しください。",
  }),
  internal: Object.freeze({
    code: "internal",
    message: "処理中に予期しないエラーが発生しました。",
  }),
});

const INVALID_INPUT_POLICY_CODES = new Set([
  USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
  USER_LIFECYCLE_POLICY_ERROR_CODES.OPERATION_ID_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.DATE_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.REASON_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.CORRECTION_REASON_INVALID,
]);

const ACTOR_POLICY_CODES = new Set([
  USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
  USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_ADMIN_STATE_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
  USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
]);

const FAILED_PRECONDITION_DOMAIN_CODES = new Set([
  LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
  LIFECYCLE_DOMAIN_ERROR_CODES.SELF_OPERATION_DENIED,
  LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_STATE_INVALID,
  LIFECYCLE_DOMAIN_ERROR_CODES.ADMIN_TARGET_DENIED,
  LIFECYCLE_DOMAIN_ERROR_CODES.SUPER_USER_TARGET_DENIED,
  LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
  LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
  LIFECYCLE_DOMAIN_ERROR_CODES.TEMPORARY_USER_LINKED,
  LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_NOT_COMPLETED,
  LIFECYCLE_DOMAIN_ERROR_CODES.ALREADY_REINSTATED,
  LIFECYCLE_DOMAIN_ERROR_CODES.LATEST_OPERATION_MISMATCH,
]);

function mapDomainCode(domainCode) {
  switch (domainCode) {
    case LIFECYCLE_DOMAIN_ERROR_CODES.UNAUTHENTICATED:
      return Object.freeze({ code: "unauthenticated", message: "認証が必要です。" });
    case LIFECYCLE_DOMAIN_ERROR_CODES.INVALID_INPUT:
      return RESPONSES.invalidInput;
    case LIFECYCLE_DOMAIN_ERROR_CODES.ACTOR_NOT_ALLOWED:
      return RESPONSES.permissionDenied;
    case LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_NOT_FOUND:
    case LIFECYCLE_DOMAIN_ERROR_CODES.SOURCE_OPERATION_NOT_FOUND:
      return RESPONSES.notFound;
    case LIFECYCLE_DOMAIN_ERROR_CODES.OPERATION_ID_CONFLICT:
      return RESPONSES.alreadyExists;
    case LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_OPERATION_ACTIVE:
      return RESPONSES.aborted;
    case LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE:
      return RESPONSES.unavailable;
    case LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL:
      return RESPONSES.internal;
    default:
      return FAILED_PRECONDITION_DOMAIN_CODES.has(domainCode)
        ? RESPONSES.failedPrecondition
        : null;
  }
}
/**
 * lifecycle operationの内部errorを、個人情報を含まない安定した応答へ変換します。
 * 未知errorおよび未知codeはfail closedでinternalへ変換します。
 *
 * @param {unknown} error
 * @returns {{code: string, message: string}}
 */
export function mapLifecycleOperationError(error) {
  if (error instanceof CallableAuthIdentityError) {
    switch (error.code) {
      case CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID:
      case CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND:
      case CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID:
      case CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID:
      case CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE:
        return RESPONSES.authIdentityInvalid;
      case CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_SERVICE_INVALID:
      default:
        return RESPONSES.internal;
    }
  }

  if (error instanceof UserLifecyclePolicyError) {
    if (INVALID_INPUT_POLICY_CODES.has(error.code)) return RESPONSES.invalidInput;
    if (ACTOR_POLICY_CODES.has(error.code)) return RESPONSES.permissionDenied;
    return RESPONSES.failedPrecondition;
  }

  const domainResponse = mapDomainCode(error?.domainCode);
  if (domainResponse) return domainResponse;

  if (error instanceof LifecycleOperationStoreError) {
    if (
      error.code === LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_ID_CONFLICT
    ) {
      return RESPONSES.alreadyExists;
    }
    if (
      error.code === LIFECYCLE_OPERATION_STORE_ERROR_CODES.TARGET_OPERATION_ACTIVE
    ) {
      return RESPONSES.aborted;
    }
    if (error.code === LIFECYCLE_OPERATION_STORE_ERROR_CODES.OPERATION_NOT_FOUND) {
      return RESPONSES.notFound;
    }
  }

  return RESPONSES.internal;
}
