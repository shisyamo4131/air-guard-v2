/*****************************************************************************
 * @file ./functions/modules/auth/mappers/mapUserAccountSetupError.js
 * @description User本登録時の内部エラーを安全なCallable応答へ変換します。
 * @method mapUserAccountSetupError 内部エラーをcodeとmessageへ変換します。
 *****************************************************************************/
import {
  USER_ACCOUNT_SETUP_ERROR_CODES,
  UserAccountSetupError,
} from "../setupUserAccount.js";
import {
  USER_ACCOUNT_SETUP_POLICY_ERROR_CODES,
  UserAccountSetupPolicyError,
} from "../policies/userAccountSetupPolicy.js";

const INTERNAL_ERROR_RESPONSE = Object.freeze({
  code: "internal",
  message: "ユーザーアカウント作成中に予期しないエラーが発生しました。",
});

const AUTH_STATE_UNAVAILABLE_RESPONSE = Object.freeze({
  code: "failed-precondition",
  message: "認証情報を確認できません。",
});

const REGISTRATION_STATE_UNAVAILABLE_RESPONSE = Object.freeze({
  code: "failed-precondition",
  message: "事前登録情報を確認できません。",
});

const REGISTRATION_NOT_FOUND_RESPONSE = Object.freeze({
  code: "not-found",
  message: "事前登録が見つかりません。",
});

const ABORTED_RESPONSE = Object.freeze({
  code: "aborted",
  message: "同時更新が発生しました。状態を更新してから再試行してください。",
});

function isFirestoreAborted(error) {
  return error?.code === 10 || error?.code === "10" || error?.code === "aborted";
}

/**
 * User本登録時の内部エラーを安全なCallable応答へ変換します。
 *
 * 内部エラーメッセージ、User UID、会社IDなどは応答へ含めません。
 *
 * @param {unknown} error - 変換対象のエラー
 * @returns {{code: string, message: string}}
 */
export function mapUserAccountSetupError(error) {
  if (error instanceof UserAccountSetupError) {
    switch (error.code) {
      case USER_ACCOUNT_SETUP_ERROR_CODES.REQUIRED_FIELD_MISSING:
        return AUTH_STATE_UNAVAILABLE_RESPONSE;

      case USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS:
        return {
          code: "already-exists",
          message: "ユーザーアカウントは既に本登録されています。",
        };

      case USER_ACCOUNT_SETUP_ERROR_CODES.EMAIL_RESERVATION_NOT_FOUND:
      case USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_NOT_FOUND:
        return REGISTRATION_NOT_FOUND_RESPONSE;

      case USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_NOT_FOUND:
      case USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_INVALID:
      case USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_MISMATCH:
        return REGISTRATION_STATE_UNAVAILABLE_RESPONSE;

      case USER_ACCOUNT_SETUP_ERROR_CODES.AUTH_SERVICE_INVALID:
      case USER_ACCOUNT_SETUP_ERROR_CODES.FIRESTORE_SERVICE_INVALID:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserAccountSetupPolicyError) {
    switch (error.code) {
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_VERIFIED_STATE_INVALID:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_UID_INVALID:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_EMAIL_INVALID:
        return AUTH_STATE_UNAVAILABLE_RESPONSE;

      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED:
        return {
          code: "failed-precondition",
          message: "メールアドレスの確認を完了してください。",
        };

      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_FOUND:
        return REGISTRATION_NOT_FOUND_RESPONSE;

      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_UNIQUE:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.RESERVATION_STATE_INVALID:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_COMPANY_MISMATCH:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_EMAIL_MISMATCH:
      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_TEMPORARY:
        return REGISTRATION_STATE_UNAVAILABLE_RESPONSE;

      case USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (isFirestoreAborted(error)) return ABORTED_RESPONSE;
  return INTERNAL_ERROR_RESPONSE;
}
