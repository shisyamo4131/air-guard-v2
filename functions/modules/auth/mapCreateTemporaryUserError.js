/*****************************************************************************
 * @file ./functions/modules/auth/mapCreateTemporaryUserError.js
 * @description 仮登録User作成時の内部エラーを安全なCallable応答へ変換します。
 *****************************************************************************/
import {
  CREATE_TEMPORARY_USER_ERROR_CODES,
  CreateTemporaryUserError,
} from "./createTemporaryUser.js";
import { mapCallableAuthIdentityError } from "./mapCallableAuthIdentityError.js";
import {
  TEMPORARY_USER_CREATION_POLICY_ERROR_CODES,
  TemporaryUserCreationPolicyError,
} from "./temporaryUserCreationPolicy.js";
import {
  TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES,
  TemporaryUserManagementPolicyError,
} from "./temporaryUserManagementPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "./userAuthCompanyPolicy.js";

const RESPONSES = Object.freeze({
  INTERNAL: {
    code: "internal",
    message: "仮登録ユーザーの作成中に予期しないエラーが発生しました。",
  },
  INVALID_ARGUMENT: {
    code: "invalid-argument",
    message: "必要な情報が不足しているか、形式が正しくありません。",
  },
  PERMISSION_DENIED: {
    code: "permission-denied",
    message: "この操作を行う権限がありません。",
  },
  ACTOR_STATE_INVALID: {
    code: "failed-precondition",
    message: "操作するユーザー情報を確認できません。",
  },
  EMAIL_EXISTS: {
    code: "already-exists",
    message: "このメールアドレスは使用できません。",
  },
  EMPLOYEE_NOT_FOUND: {
    code: "not-found",
    message: "対象従業員が見つかりません。",
  },
  EMPLOYEE_EXISTS: {
    code: "already-exists",
    message: "対象従業員には既にユーザーが紐づいています。",
  },
  EMPLOYEE_STATE_INVALID: {
    code: "failed-precondition",
    message: "対象従業員はユーザー連携できる状態ではありません。",
  },
  ABORTED: {
    code: "aborted",
    message: "同時更新が発生しました。状態を更新してから再試行してください。",
  },
});

function isFirestoreAborted(error) {
  return error?.code === 10 || error?.code === "10" || error?.code === "aborted";
}

/**
 * @param {unknown} error
 * @returns {{code: string, message: string}}
 */
export function mapCreateTemporaryUserError(error) {
  const identityResponse = mapCallableAuthIdentityError(error);
  if (identityResponse) return identityResponse;

  if (error instanceof CreateTemporaryUserError) {
    switch (error.code) {
      case CREATE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case CREATE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID:
      case CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_EMAIL_INVALID:
        return RESPONSES.INVALID_ARGUMENT;
      case CREATE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND:
        return RESPONSES.ACTOR_STATE_INVALID;
      case CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS:
      case CREATE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_EXISTS:
      case CREATE_TEMPORARY_USER_ERROR_CODES.EMAIL_USER_EXISTS:
        return RESPONSES.EMAIL_EXISTS;
      case CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_NOT_FOUND:
        return RESPONSES.EMPLOYEE_NOT_FOUND;
      case CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_EXISTS:
      case CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_USER_EXISTS:
        return RESPONSES.EMPLOYEE_EXISTS;
      case CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_SERVICE_INVALID:
      case CREATE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID:
      default:
        return RESPONSES.INTERNAL;
    }
  }

  if (error instanceof TemporaryUserCreationPolicyError) {
    switch (error.code) {
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_NOT_ACTIVE:
        return RESPONSES.EMPLOYEE_STATE_INVALID;
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.INPUT_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.UNEXPECTED_FIELD:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.IDENTIFIER_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMAIL_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.ROLES_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.ROLE_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.ROLE_DUPLICATED:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.TAG_SIZE_INVALID:
      case TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.NOTIFICATION_FLAG_INVALID:
        return RESPONSES.INVALID_ARGUMENT;
      default:
        return RESPONSES.INTERNAL;
    }
  }

  if (error instanceof TemporaryUserManagementPolicyError) {
    switch (error.code) {
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED:
        return RESPONSES.PERMISSION_DENIED;
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ADMIN_STATE_INVALID:
      case TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID:
        return RESPONSES.ACTOR_STATE_INVALID;
      default:
        return RESPONSES.INTERNAL;
    }
  }

  if (error instanceof UserAuthCompanyPolicyError) {
    switch (error.code) {
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH:
        return RESPONSES.PERMISSION_DENIED;
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID:
        return RESPONSES.ACTOR_STATE_INVALID;
      default:
        return RESPONSES.INTERNAL;
    }
  }

  if (isFirestoreAborted(error)) return RESPONSES.ABORTED;
  return RESPONSES.INTERNAL;
}
