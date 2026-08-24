/*****************************************************************************
 * @file ./functions/modules/auth/policies/rolePermissions.js
 * @description FunctionsでUser role presetをpermissionへ展開します。
 * - 既知のrole presetだけを受け入れます。
 * - 未知roleを直接permissionとして扱いません。
 * - write permissionに対応するread permissionを追加します。
 *****************************************************************************/
import { ROLE_PRESETS } from "../../../constants/rolePresets.js";

export const ROLE_PERMISSION_ERROR_CODES = Object.freeze({
  ROLES_INVALID: "roles-invalid",
  ROLE_INVALID: "role-invalid",
  UNKNOWN_ROLE: "unknown-role",
});

export class RolePermissionError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "RolePermissionError";
    this.code = code;
  }
}

/**
 * 既知のrole presetをpermission一覧へ展開します。
 * @param {Array<string>} roles
 * @returns {Array<string>}
 * @throws {RolePermissionError}
 */
export function resolveRolePermissions(roles = []) {
  if (!Array.isArray(roles)) {
    throw new RolePermissionError(
      ROLE_PERMISSION_ERROR_CODES.ROLES_INVALID,
      "[resolveRolePermissions] roles must be an array",
    );
  }

  const permissions = new Set();

  for (const role of roles) {
    if (typeof role !== "string" || role.trim().length === 0) {
      throw new RolePermissionError(
        ROLE_PERMISSION_ERROR_CODES.ROLE_INVALID,
        "[resolveRolePermissions] role must be a non-empty string",
      );
    }

    const preset = ROLE_PRESETS[role];
    if (!preset) {
      throw new RolePermissionError(
        ROLE_PERMISSION_ERROR_CODES.UNKNOWN_ROLE,
        `[resolveRolePermissions] unknown role: ${role}`,
      );
    }

    for (const permission of preset.permissions) {
      permissions.add(permission);
    }
  }

  for (const permission of [...permissions]) {
    if (permission.endsWith(":write")) {
      permissions.add(permission.replace(/:write$/, ":read"));
    }
  }

  return [...permissions];
}
