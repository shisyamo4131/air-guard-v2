/*****************************************************************************
 * @file ./functions/modules/auth/mappers/mapUserFieldUpdateError.js
 * @description User field別更新の内部errorを安全なCallable応答へ変換します。
 *****************************************************************************/
import {
  USER_FIELD_UPDATE_ERROR_CODES,
  UserFieldUpdateError,
} from "../updateUserFields.js";
import {
  USER_FIELD_UPDATE_POLICY_ERROR_CODES,
  UserFieldUpdatePolicyError,
} from "../policies/userFieldUpdatePolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../policies/userAuthCompanyPolicy.js";
import { mapCallableAuthIdentityError } from "./mapCallableAuthIdentityError.js";

const INTERNAL_ERROR_RESPONSE = Object.freeze({
  code: "internal",
  message: "ユーザー情報の更新中に予期しないエラーが発生しました。",
});

export function mapUserFieldUpdateError(error) {
  const authIdentityResponse = mapCallableAuthIdentityError(error);
  if (authIdentityResponse) return authIdentityResponse;

  if (error instanceof UserFieldUpdateError) {
    switch (error.code) {
      case USER_FIELD_UPDATE_ERROR_CODES.REQUIRED_FIELD_MISSING:
        return {
          code: "invalid-argument",
          message: "必要な情報が不足しているか、形式が正しくありません。",
        };
      case USER_FIELD_UPDATE_ERROR_CODES.ACTOR_USER_NOT_FOUND:
        return {
          code: "failed-precondition",
          message: "操作するユーザー情報を確認できません。",
        };
      case USER_FIELD_UPDATE_ERROR_CODES.TARGET_USER_NOT_FOUND:
        return { code: "not-found", message: "対象ユーザーが見つかりません。" };
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserFieldUpdatePolicyError) {
    switch (error.code) {
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.UNEXPECTED_FIELD:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.IDENTIFIER_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.TAG_SIZE_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.NOTIFICATION_FLAG_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLES_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLE_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLE_DUPLICATED:
        return {
          code: "invalid-argument",
          message: "更新内容の形式が正しくありません。",
        };
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID:
        return {
          code: "permission-denied",
          message: "この操作を行う権限がありません。",
        };
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.SELF_ROLE_CHANGE_FORBIDDEN:
        return {
          code: "failed-precondition",
          message: "自分自身の役割を変更することはできません。",
        };
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN:
        return {
          code: "failed-precondition",
          message: "会社管理者の役割を変更することはできません。",
        };
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_NOT_ACTIVE:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_DISABLED_STATE_INVALID:
      case USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_ADMIN_STATE_INVALID:
        return {
          code: "failed-precondition",
          message: "ユーザーはこの操作を行える状態ではありません。",
        };
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  if (error instanceof UserAuthCompanyPolicyError) {
    switch (error.code) {
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH:
        return {
          code: "permission-denied",
          message: "この操作を行う権限がありません。",
        };
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY:
      case USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID:
        return {
          code: "failed-precondition",
          message: "ユーザーはこの操作を行える状態ではありません。",
        };
      default:
        return INTERNAL_ERROR_RESPONSE;
    }
  }

  return INTERNAL_ERROR_RESPONSE;
}
