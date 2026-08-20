/*****************************************************************************
 * @file ./functions/modules/auth/temporaryUserDeletionPolicy.js
 * @description 仮登録Userを削除対象にできる状態であることを検証します。
 * @method assertTemporaryUserCanBeDeleted
 *****************************************************************************/

export const TEMPORARY_USER_DELETION_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  TARGET_COMPANY_MISMATCH: "target-company-mismatch",
  TARGET_TEMPORARY_STATE_INVALID: "target-temporary-state-invalid",
  TARGET_NOT_TEMPORARY: "target-not-temporary",
  TARGET_ADMIN_STATE_INVALID: "target-admin-state-invalid",
  TARGET_IS_ADMIN: "target-is-admin",
  TARGET_DISABLED_STATE_INVALID: "target-disabled-state-invalid",
  TARGET_NOT_ACTIVE: "target-not-active",
  TARGET_EMPLOYEE_ID_INVALID: "target-employee-id-invalid",
});

export class TemporaryUserDeletionPolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "TemporaryUserDeletionPolicyError";
    this.code = code;
  }
}

/**
 * 同一会社の有効な仮登録Userだけを削除対象として許可します。
 * @param {Object} param
 * @param {string} param.companyId
 * @param {Object} param.targetUser
 * @throws {TemporaryUserDeletionPolicyError}
 */
export function assertTemporaryUserCanBeDeleted({
  companyId,
  targetUser,
} = {}) {
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    !targetUser ||
    typeof targetUser !== "object" ||
    Array.isArray(targetUser)
  ) {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[assertTemporaryUserCanBeDeleted] Required fields are missing",
    );
  }

  if (targetUser.companyId !== companyId) {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_COMPANY_MISMATCH,
      "[assertTemporaryUserCanBeDeleted] Target companyId does not match companyId",
    );
  }

  if (typeof targetUser.isTemporary !== "boolean") {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES
        .TARGET_TEMPORARY_STATE_INVALID,
      "[assertTemporaryUserCanBeDeleted] Target temporary state is invalid",
    );
  }

  if (targetUser.isTemporary !== true) {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_NOT_TEMPORARY,
      "[assertTemporaryUserCanBeDeleted] Target is not temporary",
    );
  }

  if (typeof targetUser.isAdmin !== "boolean") {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
      "[assertTemporaryUserCanBeDeleted] Target admin state is invalid",
    );
  }

  if (targetUser.isAdmin !== false) {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
      "[assertTemporaryUserCanBeDeleted] Target is an administrator",
    );
  }

  if (typeof targetUser.disabled !== "boolean") {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID,
      "[assertTemporaryUserCanBeDeleted] Target disabled state is invalid",
    );
  }

  if (targetUser.disabled !== false) {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE,
      "[assertTemporaryUserCanBeDeleted] Target is not active",
    );
  }

  const { employeeId } = targetUser;
  if (
    employeeId !== undefined &&
    employeeId !== null &&
    (typeof employeeId !== "string" ||
      (employeeId.length > 0 &&
        (employeeId.trim() !== employeeId || employeeId.includes("/"))))
  ) {
    throw new TemporaryUserDeletionPolicyError(
      TEMPORARY_USER_DELETION_POLICY_ERROR_CODES.TARGET_EMPLOYEE_ID_INVALID,
      "[assertTemporaryUserCanBeDeleted] Target employeeId is invalid",
    );
  }
}
