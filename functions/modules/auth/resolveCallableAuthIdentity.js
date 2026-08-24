/*****************************************************************************
 * @file ./functions/modules/auth/resolveCallableAuthIdentity.js
 * @description 確立済みCallable実行者のtokenと現在Authを照合します。
 * @method resolveCallableAuthIdentity - 検証済みの実行者identityを返します。
 *****************************************************************************/
import {
  assertAuthUserCompany,
  UserAuthCompanyPolicyError,
} from "./policies/userAuthCompanyPolicy.js";

export const CALLABLE_AUTH_IDENTITY_ERROR_CODES = Object.freeze({
  TOKEN_IDENTITY_INVALID: "token-identity-invalid",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  AUTH_USER_NOT_FOUND: "auth-user-not-found",
  CURRENT_AUTH_IDENTITY_INVALID: "current-auth-identity-invalid",
  CURRENT_AUTH_STATE_INVALID: "current-auth-state-invalid",
  CURRENT_AUTH_NOT_ACTIVE: "current-auth-not-active",
});

/**
 * Callable実行者のAuth identity検証で発生するエラーです。
 */
export class CallableAuthIdentityError extends Error {
  /**
   * @param {string} code - エラーコード
   * @param {string} message - エラーメッセージ
   * @param {{ cause?: unknown }} [options] - エラーの追加情報
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "CallableAuthIdentityError";
    this.code = code;
  }
}

/**
 * 確立済み会社所属UserのCallable tokenと現在Authを照合します。
 *
 * `companyId`と`isSuperUser`がまだ確立していない登録途中Userには使用しません。
 * API固有の管理者・スーパーユーザー・対象data検査は呼出し側で続けます。
 *
 * @param {Object} param - 実行者identityの検証情報
 * @param {Object} param.auth - Firebase Authenticationサービス
 * @param {string} param.tokenUid - Callable tokenのUID
 * @param {string} param.tokenEmail - Callable tokenのメールアドレス
 * @param {boolean} param.tokenEmailVerified - Callable tokenのメール確認状態
 * @param {string} param.tokenCompanyId - Callable tokenの会社ID
 * @param {boolean} param.tokenIsSuperUser - Callable tokenのスーパーユーザー状態
 * @returns {Promise<Readonly<{
 *   uid: string,
 *   email: string,
 *   companyId: string,
 *   isSuperUser: boolean
 * }>>} 検証済みidentity
 * @throws {CallableAuthIdentityError} token、Auth依存、現在Authが不正な場合
 */
export async function resolveCallableAuthIdentity({
  auth,
  tokenUid,
  tokenEmail,
  tokenEmailVerified,
  tokenCompanyId,
  tokenIsSuperUser,
} = {}) {
  if (
    typeof tokenUid !== "string" ||
    !tokenUid.trim() ||
    typeof tokenEmail !== "string" ||
    !tokenEmail.trim() ||
    tokenEmailVerified !== true ||
    typeof tokenCompanyId !== "string" ||
    !tokenCompanyId.trim() ||
    typeof tokenIsSuperUser !== "boolean"
  ) {
    throw new CallableAuthIdentityError(
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID,
      "[resolveCallableAuthIdentity] Callable token identity is invalid",
    );
  }

  if (!auth || typeof auth.getUser !== "function") {
    throw new CallableAuthIdentityError(
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[resolveCallableAuthIdentity] Auth service must provide getUser",
    );
  }

  let authUser;
  try {
    authUser = await auth.getUser(tokenUid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw new CallableAuthIdentityError(
        CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
        "[resolveCallableAuthIdentity] Current Auth account was not found",
        { cause: error },
      );
    }
    throw error;
  }

  try {
    assertAuthUserCompany({
      pathCompanyId: tokenCompanyId,
      docId: tokenUid,
      authUser,
    });
  } catch (error) {
    if (error instanceof UserAuthCompanyPolicyError) {
      throw new CallableAuthIdentityError(
        CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
        "[resolveCallableAuthIdentity] Current Auth identity is inconsistent",
        { cause: error },
      );
    }
    throw error;
  }

  if (
    typeof authUser.email !== "string" ||
    authUser.email !== tokenEmail ||
    authUser.emailVerified !== true ||
    authUser.customClaims?.isSuperUser !== tokenIsSuperUser
  ) {
    throw new CallableAuthIdentityError(
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
      "[resolveCallableAuthIdentity] Current Auth identity does not match token",
    );
  }

  if (typeof authUser.disabled !== "boolean") {
    throw new CallableAuthIdentityError(
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID,
      "[resolveCallableAuthIdentity] Current Auth disabled state is invalid",
    );
  }

  if (authUser.disabled === true) {
    throw new CallableAuthIdentityError(
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
      "[resolveCallableAuthIdentity] Current Auth account is not active",
    );
  }

  return Object.freeze({
    uid: tokenUid,
    email: tokenEmail,
    companyId: tokenCompanyId,
    isSuperUser: tokenIsSuperUser,
  });
}
