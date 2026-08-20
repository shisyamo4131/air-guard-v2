/*****************************************************************************
 * @file ./functions/modules/auth/mapCreateAdminAccountError.js
 * @description 初期管理者作成errorを安全なCallable応答へ変換します。
 *****************************************************************************/
import {
  CREATE_ADMIN_ACCOUNT_ERROR_CODES,
  CreateAdminAccountError,
} from "./createAdminAccount.js";
import {
  INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES,
  InitialAdminAccountPolicyError,
} from "./initialAdminAccountPolicy.js";

const RESPONSES = Object.freeze({
  INTERNAL: { code: "internal", message: "管理者アカウント作成中に予期しないエラーが発生しました。" },
  INVALID: { code: "invalid-argument", message: "会社情報または管理者情報の形式が正しくありません。" },
  AUTH_STATE: { code: "failed-precondition", message: "認証情報を確認できません。" },
  EXISTING_STATE: { code: "failed-precondition", message: "既存のアカウント情報を確認できません。" },
  EMAIL_EXISTS: { code: "already-exists", message: "このメールアドレスは既に使用されています。" },
  ABORTED: { code: "aborted", message: "同時更新が発生しました。状態を更新してから再試行してください。" },
});

function isAborted(error) {
  return error?.code === 10 || error?.code === "10" || error?.code === "aborted";
}

export function mapCreateAdminAccountError(error) {
  if (error instanceof InitialAdminAccountPolicyError) {
    switch (error.code) {
      case INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.INPUT_INVALID:
        return RESPONSES.INVALID;
      case INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.AUTH_IDENTITY_INVALID:
        return RESPONSES.AUTH_STATE;
      case INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.RESERVATION_CONFLICT:
        return RESPONSES.EMAIL_EXISTS;
      case INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.RESERVATION_INVALID:
      case INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.EXISTING_STATE_INVALID:
        return RESPONSES.EXISTING_STATE;
      default:
        return RESPONSES.INTERNAL;
    }
  }
  if (error instanceof CreateAdminAccountError) {
    switch (error.code) {
      case CREATE_ADMIN_ACCOUNT_ERROR_CODES.CANDIDATE_CONFLICT:
        return RESPONSES.ABORTED;
      case CREATE_ADMIN_ACCOUNT_ERROR_CODES.AUTH_SERVICE_INVALID:
      case CREATE_ADMIN_ACCOUNT_ERROR_CODES.FIRESTORE_SERVICE_INVALID:
      default:
        return RESPONSES.INTERNAL;
    }
  }
  if (isAborted(error)) return RESPONSES.ABORTED;
  return RESPONSES.INTERNAL;
}
