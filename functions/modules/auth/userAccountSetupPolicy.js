/*****************************************************************************
 * @file ./functions/modules/auth/userAccountSetupPolicy.js
 * @description 一般Userの本登録に必要な本人確認と仮登録状態を検証します。
 * @method resolveUserAccountSetupRegistration 本登録に使用できる仮登録を返します。
 *****************************************************************************/

export const USER_ACCOUNT_SETUP_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  EMAIL_VERIFIED_STATE_INVALID: "email-verified-state-invalid",
  EMAIL_NOT_VERIFIED: "email-not-verified",
  REGISTRATION_NOT_FOUND: "registration-not-found",
  REGISTRATION_NOT_UNIQUE: "registration-not-unique",
  REGISTRATION_STATE_INVALID: "registration-state-invalid",
  REGISTRATION_COMPANY_MISMATCH: "registration-company-mismatch",
  REGISTRATION_EMAIL_MISMATCH: "registration-email-mismatch",
  REGISTRATION_NOT_TEMPORARY: "registration-not-temporary",
});

/**
 * User本登録ポリシーの検証エラーです。
 */
export class UserAccountSetupPolicyError extends Error {
  /**
   * @param {string} code - エラーコード
   * @param {string} message - エラーメッセージ
   * @param {{ cause?: unknown }} [options] - エラーの追加情報
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserAccountSetupPolicyError";
    this.code = code;
  }
}

/**
 * 一般Userの本登録に使用できる仮登録を返します。
 *
 * この関数はFirestoreやAuthenticationへアクセスしません。
 * 呼び出し側が認証情報のメールアドレスで検索した仮登録を検証します。
 *
 * @param {Object} param - 検証対象
 * @param {string} param.authUid - 本登録を行うAuthentication UserのUID
 * @param {string} param.authEmail - Authenticationで確認したメールアドレス
 * @param {boolean} param.authEmailVerified - メールアドレス確認済み状態
 * @param {Object[]} param.registrations - authEmailに一致した仮登録User一覧
 * @returns {Object} 本登録に使用できる唯一の仮登録User
 * @throws {UserAccountSetupPolicyError} ポリシーに違反した場合
 */
export function resolveUserAccountSetupRegistration({
  authUid,
  authEmail,
  authEmailVerified,
  registrations,
} = {}) {
  if (
    typeof authUid !== "string" ||
    !authUid ||
    typeof authEmail !== "string" ||
    !authEmail ||
    !Array.isArray(registrations)
  ) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[resolveUserAccountSetupRegistration] Required fields are missing",
    );
  }

  if (typeof authEmailVerified !== "boolean") {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_VERIFIED_STATE_INVALID,
      "[resolveUserAccountSetupRegistration] Email verified state is invalid",
    );
  }

  if (authEmailVerified !== true) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
      "[resolveUserAccountSetupRegistration] Email is not verified",
    );
  }

  if (registrations.length === 0) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_FOUND,
      "[resolveUserAccountSetupRegistration] Pre-registration was not found",
    );
  }

  if (registrations.length !== 1) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_UNIQUE,
      "[resolveUserAccountSetupRegistration] Pre-registration is not unique",
    );
  }

  const registration = registrations[0];

  if (
    !registration ||
    typeof registration !== "object" ||
    typeof registration.id !== "string" ||
    !registration.id ||
    typeof registration.pathCompanyId !== "string" ||
    !registration.pathCompanyId ||
    typeof registration.companyId !== "string" ||
    !registration.companyId ||
    typeof registration.email !== "string" ||
    !registration.email ||
    typeof registration.isTemporary !== "boolean"
  ) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
      "[resolveUserAccountSetupRegistration] Pre-registration state is invalid",
    );
  }

  if (registration.companyId !== registration.pathCompanyId) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_COMPANY_MISMATCH,
      "[resolveUserAccountSetupRegistration] Pre-registration company does not match document path",
    );
  }

  if (registration.email !== authEmail) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_EMAIL_MISMATCH,
      "[resolveUserAccountSetupRegistration] Pre-registration email does not match authenticated email",
    );
  }

  if (registration.isTemporary !== true) {
    throw new UserAccountSetupPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_TEMPORARY,
      "[resolveUserAccountSetupRegistration] User is not temporary",
    );
  }

  return registration;
}
