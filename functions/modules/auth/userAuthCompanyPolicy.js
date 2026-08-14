/*****************************************************************************
 * @file ./functions/modules/auth/userAuthCompanyPolicy.js
 * @description 利用者、所属会社、Auth アカウントの整合性検証および Auth アカウントの変更検知を行うためのモジュール群です。
 * @method assertUserDocumentCompany - 利用者と所属会社の整合性を検証します。
 * @method assertAuthUserCompany - Auth アカウントと所属会社の整合性を検証します。
 * @method hasAuthRelevantChanges - User ドキュメントに Auth への同期に必要な変更があるかを返します。
 *****************************************************************************/
export const USER_AUTH_COMPANY_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  USER_COMPANY_MISMATCH: "user-company-mismatch",
  AUTH_UID_MISMATCH: "auth-uid-mismatch",
  AUTH_COMPANY_MISSING: "auth-company-missing",
  AUTH_COMPANY_MISMATCH: "auth-company-mismatch",
  USER_IS_TEMPORARY: "user-is-temporary",
  USER_TEMPORARY_STATE_INVALID: "user-temporary-state-invalid",
});

/**
 * Custom error class for user authentication and company policy errors.
 */
export class UserAuthCompanyPolicyError extends Error {
  /**
   * Creates a new UserAuthCompanyPolicyError.
   * @param {string} code - error code.
   * @param {string} message - error message.
   * @param {{ cause?: unknown }} [options] - optional error options, including cause.
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserAuthCompanyPolicyError";
    this.code = code;
  }
}

/**
 * Asserts that the user belongs to the company specified in the request path and is not a temporary user.
 * @param {Object} param - The parameters object
 * @param {string} param.pathCompanyId - The company ID from the request path.
 * @param {Object} param.userData - The user's data
 * @throws {UserAuthCompanyPolicyError} - If required fields are missing
 * @throws {UserAuthCompanyPolicyError} - If the user does not have company consistency
 */
export function assertUserDocumentCompany({ pathCompanyId, userData } = {}) {
  if (!pathCompanyId || !userData) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[assertUserDocumentCompany] Required fields are missing",
    );
  }
  if (userData.companyId !== pathCompanyId) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
      "[assertUserDocumentCompany] User companyId does not match path companyId",
    );
  }
  if (userData?.isTemporary === true) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
      "[assertUserDocumentCompany] User is temporary",
    );
  }
  if (userData.isTemporary !== false) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
      "[assertUserDocumentCompany] User temporary state is invalid",
    );
  }
}

/**
 * Asserts that the authenticated account belongs to the company specified in the request path and is not a temporary user.
 * @param {Object} param - The parameters object
 * @param {string} param.pathCompanyId - The company ID from the request path
 * @param {string} param.docId - The User document ID
 * @param {Object} param.authUser - The authenticated account's data
 * @throws {UserAuthCompanyPolicyError} - If required fields are missing
 * @throws {UserAuthCompanyPolicyError} - If the authenticated account does not have company consistency
 */
export function assertAuthUserCompany({ pathCompanyId, docId, authUser } = {}) {
  if (!pathCompanyId || !docId || !authUser) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[assertAuthUserCompany] Required fields are missing",
    );
  }

  const authCompanyId = authUser.customClaims?.companyId;
  if (!authCompanyId) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING,
      "[assertAuthUserCompany] Auth account companyId is missing",
    );
  }
  if (authCompanyId !== pathCompanyId) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
      "[assertAuthUserCompany] Auth account companyId does not match path companyId",
    );
  }

  if (authUser.uid !== docId) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH,
      "[assertAuthUserCompany] Auth account ID does not match document ID",
    );
  }
}

/**
 * Checks if there are any relevant changes to the user's authentication data.
 * @param {Object} param - The parameters object
 * @param {Object} param.beforeData - The user's data before the changes
 * @param {Object} param.afterData - The user's data after the changes
 * @returns {boolean} - True if there are relevant changes
 * @throws {UserAuthCompanyPolicyError} - If required fields are missing
 */
export function hasAuthRelevantChanges({ beforeData, afterData } = {}) {
  if (!beforeData || !afterData) {
    throw new UserAuthCompanyPolicyError(
      USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[hasAuthRelevantChanges] Required fields are missing",
    );
  }

  const { displayName: beforeDisplayName, disabled: beforeDisabled } =
    beforeData;
  const { displayName: afterDisplayName, disabled: afterDisabled } = afterData;

  const displayNameChanged = beforeDisplayName !== afterDisplayName;
  const disabledChanged = beforeDisabled !== afterDisabled;

  return displayNameChanged || disabledChanged;
}
