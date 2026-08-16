/*****************************************************************************
 * @file ./functions/modules/auth/mapCompanyAdminTransferError.js
 * @description 会社管理者移譲時の内部エラーを安全なCallable応答へ変換します。
 * @method mapCompanyAdminTransferError 内部エラーをcodeとmessageへ変換します。
 *****************************************************************************/
import {
  COMPANY_ADMIN_TRANSFER_ERROR_CODES,
  CompanyAdminTransferError,
} from "./transferCompanyAdmin.js";
import {
  COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES,
  CompanyAdminTransferPolicyError,
} from "./companyAdminTransferPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "./userAuthCompanyPolicy.js";
import {
  mapCallableAuthIdentityError,
} from "./mapCallableAuthIdentityError.js";

const INTERNAL_ERROR_RESPONSE = Object.freeze({
  code: "internal",
  message: "管理者権限の移譲中に予期しないエラーが発生しました。",
});

const PERMISSION_DENIED_RESPONSE = Object.freeze({
  code: "permission-denied",
  message: "この操作を行う権限がありません。",
});

const USER_STATE_UNAVAILABLE_RESPONSE = Object.freeze({
  code: "failed-precondition",
  message: "管理者移譲に必要なユーザー情報を確認できません。",
});

const TARGET_STATE_INVALID_RESPONSE = Object.freeze({
  code: "failed-precondition",
  message: "移譲先ユーザーは管理者権限を受け取れる状態ではありません。",
});

/**
 * 会社管理者移譲時の内部エラーを安全なCallable応答へ変換します。
 *
 * 内部エラーメッセージ、User UID、会社IDなどは応答へ含めません。
 *
 * @param {unknown} error - 変換対象のエラー
 * @returns {{code: string, message: string}}
 */
export function mapCompanyAdminTransferError(error) {
  const authIdentityResponse = mapCallableAuthIdentityError(error);
  if (authIdentityResponse) return authIdentityResponse;

  if (error instanceof CompanyAdminTransferError) {
    switch (error.code) {
      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.REQUIRED_FIELD_MISSING:
        return {
          code: "invalid-argument",
          message: "必要な情報が不足しているか、形式が正しくありません。",
        };

      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_USER_NOT_FOUND:
      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_USER_NOT_FOUND:
        return USER_STATE_UNAVAILABLE_RESPONSE;

      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_NOT_ACTIVE:
        return TARGET_STATE_INVALID_RESPONSE;

      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_DISABLED_STATE_INVALID:
        return USER_STATE_UNAVAILABLE_RESPONSE;

      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.AUTH_SERVICE_INVALID:
      case COMPANY_ADMIN_TRANSFER_ERROR_CODES.FIRESTORE_SERVICE_INVALID:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof CompanyAdminTransferPolicyError) {
    switch (error.code) {
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_NOT_CURRENT_ADMIN:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ADMIN:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ACTIVE:
        return PERMISSION_DENIED_RESPONSE;

      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_TARGET_SAME:
        return {
          code: "invalid-argument",
          message: "移譲元と移譲先には別のユーザーを指定してください。",
        };

      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.CURRENT_ADMIN_COUNT_INVALID:
        return {
          code: "failed-precondition",
          message: "現在の会社管理者を一意に確認できません。",
        };

      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_ADMIN_STATE_INVALID:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_DISABLED_STATE_INVALID:
        return {
          code: "failed-precondition",
          message: "現在の会社管理者の状態を確認できません。",
        };

      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ALREADY_ADMIN:
      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE:
        return TARGET_STATE_INVALID_RESPONSE;

      case COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserAuthCompanyPolicyError) {
    switch (error.code) {
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH:
        return PERMISSION_DENIED_RESPONSE;

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING:
        return USER_STATE_UNAVAILABLE_RESPONSE;

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID:
        return TARGET_STATE_INVALID_RESPONSE;

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  // Auth Userの存在有無を外部へ明示しない
  if (error?.code === "auth/user-not-found") {
    return USER_STATE_UNAVAILABLE_RESPONSE;
  }

  return INTERNAL_ERROR_RESPONSE;
}
