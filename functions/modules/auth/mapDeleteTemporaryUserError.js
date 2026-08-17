/*****************************************************************************
 * @file ./functions/modules/auth/mapDeleteTemporaryUserError.js
 * @description 仮登録User削除時の内部エラーを安全なCallable応答へ変換します。
 * @method mapDeleteTemporaryUserError
 *****************************************************************************/
import {
  DELETE_TEMPORARY_USER_ERROR_CODES,
  DeleteTemporaryUserError,
} from "./deleteTemporaryUser.js";
import { mapCallableAuthIdentityError } from "./mapCallableAuthIdentityError.js";
import {
  TEMPORARY_USER_DELETION_POLICY_ERROR_CODES,
  TemporaryUserDeletionPolicyError,
} from "./temporaryUserDeletionPolicy.js";
import {
  TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES,
  TemporaryUserManagementPolicyError,
} from "./temporaryUserManagementPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "./userAuthCompanyPolicy.js";

const INTERNAL_ERROR_RESPONSE = Object.freeze({
  code: "internal",
  message: "仮登録ユーザーの削除中に予期しないエラーが発生しました。",
});

const INVALID_ARGUMENT_RESPONSE = Object.freeze({
  code: "invalid-argument",
  message: "必要な情報が不足しているか、形式が正しくありません。",
});

const PERMISSION_DENIED_RESPONSE = Object.freeze({
  code: "permission-denied",
  message: "この操作を行う権限がありません。",
});

const ACTOR_STATE_UNAVAILABLE_RESPONSE = Object.freeze({
  code: "failed-precondition",
  message: "操作するユーザー情報を確認できません。",
});

const TARGET_STATE_INVALID_RESPONSE = Object.freeze({
  code: "failed-precondition",
  message: "対象ユーザーは削除できる仮登録状態ではありません。",
});

/**
 * 仮登録User削除時の内部エラーを安全なCallable応答へ変換します。
 * @param {unknown} error
 * @returns {{code: string, message: string}}
 */
export function mapDeleteTemporaryUserError(error) {
  const authIdentityResponse = mapCallableAuthIdentityError(error);
  if (authIdentityResponse) return authIdentityResponse;

  if (error instanceof DeleteTemporaryUserError) {
    switch (error.code) {
      case DELETE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case DELETE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID:
        return INVALID_ARGUMENT_RESPONSE;

      case DELETE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND:
        return ACTOR_STATE_UNAVAILABLE_RESPONSE;

      case DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_USER_NOT_FOUND:
        return {
          code: "not-found",
          message: "対象ユーザーが見つかりません。",
        };

      case DELETE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof TemporaryUserManagementPolicyError) {
    switch (error.code) {
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED:
        return PERMISSION_DENIED_RESPONSE;

      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES
        .ACTOR_DISABLED_STATE_INVALID:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES
        .ACTOR_ADMIN_STATE_INVALID:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID:
        return ACTOR_STATE_UNAVAILABLE_RESPONSE;

      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof TemporaryUserDeletionPolicyError) {
    switch (error.code) {
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_COMPANY_MISMATCH:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES
        .TARGET_TEMPORARY_STATE_INVALID:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_NOT_TEMPORARY:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES
        .TARGET_ADMIN_STATE_INVALID:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_IS_ADMIN:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES
        .TARGET_DISABLED_STATE_INVALID:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE:
      case TEMPORARY_USER_DELETION_POLICY_ERROR_CODES
        .TARGET_EMPLOYEE_ID_INVALID:
        return TARGET_STATE_INVALID_RESPONSE;

      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserAuthCompanyPolicyError) {
    switch (error.code) {
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH:
        return PERMISSION_DENIED_RESPONSE;

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID:
        return ACTOR_STATE_UNAVAILABLE_RESPONSE;

      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  return INTERNAL_ERROR_RESPONSE;
}
