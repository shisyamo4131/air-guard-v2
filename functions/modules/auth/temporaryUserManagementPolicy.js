/*****************************************************************************
 * @file ./functions/modules/auth/temporaryUserManagementPolicy.js
 * @description 仮登録Userを管理できる実行者であることを検証します。
 * @method assertActorCanManageTemporaryUsers
 *****************************************************************************/
import { resolveRolePermissions, RolePermissionError } from "./rolePermissions.js";
import { assertUserDocumentCompany } from "./userAuthCompanyPolicy.js";

export const TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  ACTOR_DISABLED_STATE_INVALID: "actor-disabled-state-invalid",
  ACTOR_NOT_ACTIVE: "actor-not-active",
  ACTOR_ADMIN_STATE_INVALID: "actor-admin-state-invalid",
  ACTOR_ROLES_INVALID: "actor-roles-invalid",
  ACTOR_PERMISSION_DENIED: "actor-permission-denied",
});

export class TemporaryUserManagementPolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "TemporaryUserManagementPolicyError";
    this.code = code;
  }
}

/**
 * 会社管理者またはusers:write保有者であることを検証します。
 * @param {Object} param
 * @param {string} param.companyId
 * @param {Object} param.actorUser
 * @throws {TemporaryUserManagementPolicyError}
 * @throws {UserAuthCompanyPolicyError}
 */
export function assertActorCanManageTemporaryUsers({
  companyId,
  actorUser,
} = {}) {
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    !actorUser ||
    typeof actorUser !== "object" ||
    Array.isArray(actorUser)
  ) {
    throw new TemporaryUserManagementPolicyError(
      TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[assertActorCanManageTemporaryUsers] Required fields are missing",
    );
  }

  assertUserDocumentCompany({
    pathCompanyId: companyId,
    userData: actorUser,
  });

  if (typeof actorUser.disabled !== "boolean") {
    throw new TemporaryUserManagementPolicyError(
      TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
      "[assertActorCanManageTemporaryUsers] Actor disabled state is invalid",
    );
  }

  if (actorUser.disabled === true) {
    throw new TemporaryUserManagementPolicyError(
      TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
      "[assertActorCanManageTemporaryUsers] Actor is not active",
    );
  }

  if (typeof actorUser.isAdmin !== "boolean") {
    throw new TemporaryUserManagementPolicyError(
      TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ADMIN_STATE_INVALID,
      "[assertActorCanManageTemporaryUsers] Actor admin state is invalid",
    );
  }

  let permissions;
  try {
    permissions = resolveRolePermissions(actorUser.roles);
  } catch (error) {
    if (error instanceof RolePermissionError) {
      throw new TemporaryUserManagementPolicyError(
        TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
        "[assertActorCanManageTemporaryUsers] Actor roles are invalid",
        { cause: error },
      );
    }
    throw error;
  }

  if (actorUser.isAdmin !== true && !permissions.includes("users:write")) {
    throw new TemporaryUserManagementPolicyError(
      TEMPORARY_USER_MANAGEMENT_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
      "[assertActorCanManageTemporaryUsers] Actor cannot manage temporary Users",
    );
  }
}
