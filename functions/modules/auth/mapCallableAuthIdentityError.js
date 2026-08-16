/*****************************************************************************
 * @file ./functions/modules/auth/mapCallableAuthIdentityError.js
 * @description Callable実行者のAuth整合性エラーを安全な応答へ変換します。
 * @method mapCallableAuthIdentityError - 共通Authエラーを変換します。
 *****************************************************************************/
import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
} from "./resolveCallableAuthIdentity.js";

const PERMISSION_DENIED_RESPONSE = Object.freeze({
  code: "permission-denied",
  message: "この操作を行う権限がありません。",
});

const INTERNAL_ERROR_RESPONSE = Object.freeze({
  code: "internal",
  message: "認証情報の確認中に予期しないエラーが発生しました。",
});

/**
 * 共通Auth整合性エラーを、内部情報を含まないCallable応答へ変換します。
 *
 * 対象外のエラーには`null`を返し、API固有のmapperへ処理を委ねます。
 * 型付きエラーの未知codeは安全側で`internal`へ変換します。
 *
 * @param {unknown} error - 変換対象のエラー
 * @returns {{code: string, message: string} | null} 安全な応答または対象外
 */
export function mapCallableAuthIdentityError(error) {
  if (!(error instanceof CallableAuthIdentityError)) return null;

  switch (error.code) {
    case CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID:
    case CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND:
    case CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID:
    case CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID:
    case CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE:
      return PERMISSION_DENIED_RESPONSE;

    case CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_SERVICE_INVALID:
    default:
      return INTERNAL_ERROR_RESPONSE;
  }
}
