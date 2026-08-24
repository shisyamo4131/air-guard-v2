/*****************************************************************************
 * @file ./functions/modules/auth/mappers/mapUserEnabledStateError.js
 * @description User有効状態変更時の内部エラーを安全なCallable応答へ変換します。
 * @method mapUserEnabledStateError - 内部エラーをcodeとmessageへ変換します。
 *****************************************************************************/
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../policies/userAuthCompanyPolicy.js";
import {
  USER_ENABLED_STATE_POLICY_ERROR_CODES,
  UserEnabledStatePolicyError,
} from "../policies/userEnabledStatePolicy.js";
import {
  USER_ENABLED_STATE_CHANGE_ERROR_CODES,
  UserEnabledStateChangeError,
} from "../changeUserEnabledState.js";
import { mapCallableAuthIdentityError } from "./mapCallableAuthIdentityError.js";

const INTERNAL_ERROR_RESPONSE = Object.freeze({
  code: "internal",
  message: "ユーザーの状態変更中に予期しないエラーが発生しました。",
});

/**
 * User有効状態変更時の内部エラーを安全なCallable応答へ変換します。
 *
 * @param {unknown} error - 変換対象のエラー
 * @returns {{ code: string, message: string }}
 */
export function mapUserEnabledStateError(error) {
  const authIdentityResponse = mapCallableAuthIdentityError(error);
  if (authIdentityResponse) return authIdentityResponse;

  if (error instanceof UserEnabledStateChangeError) {
    switch (error.code) {
      case USER_ENABLED_STATE_CHANGE_ERROR_CODES.REQUIRED_FIELD_MISSING:
      case USER_ENABLED_STATE_CHANGE_ERROR_CODES.ENABLED_STATE_INVALID:
        return {
          code: "invalid-argument",
          message: "必要な情報が不足しているか、形式が正しくありません。",
        };

      case USER_ENABLED_STATE_CHANGE_ERROR_CODES.ACTOR_USER_NOT_FOUND:
        return {
          code: "failed-precondition",
          message: "操作するユーザー情報を確認できません。",
        };

      case USER_ENABLED_STATE_CHANGE_ERROR_CODES.TARGET_USER_NOT_FOUND:
        return {
          code: "not-found",
          message: "対象ユーザーが見つかりません。",
        };

      case USER_ENABLED_STATE_CHANGE_ERROR_CODES.AUTH_SERVICE_INVALID:
      case USER_ENABLED_STATE_CHANGE_ERROR_CODES.FIRESTORE_SERVICE_INVALID:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserEnabledStatePolicyError) {
    switch (error.code) {
      case USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN:
      case USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE:
        return {
          code: "permission-denied",
          message: "この操作を行う権限がありません。",
        };

      case USER_ENABLED_STATE_POLICY_ERROR_CODES.SELF_STATUS_CHANGE_FORBIDDEN:
        return {
          code: "failed-precondition",
          message: "自分自身を有効化または無効化することはできません。",
        };

      case USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN:
        return {
          code: "failed-precondition",
          message:
            "会社管理者を有効化または無効化することはできません。先に管理者権限を移譲してください。",
        };

      case USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID:
      case USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID:
        return {
          code: "failed-precondition",
          message: "ユーザーの状態を確認できません。",
        };

      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserAuthCompanyPolicyError) {
    switch (error.code) {
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH:
        return {
          code: "permission-denied",
          message: "この操作を行う権限がありません。",
        };

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING:
        return {
          code: "failed-precondition",
          message: "対象ユーザーの認証情報を確認できません。",
        };

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID:
        return {
          code: "failed-precondition",
          message: "対象ユーザーはこの操作を行える状態ではありません。",
        };

      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING:
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error?.code === "auth/user-not-found") {
    return {
      code: "not-found",
      message: "対象ユーザーが見つかりません。",
    };
  }

  return INTERNAL_ERROR_RESPONSE;
}
