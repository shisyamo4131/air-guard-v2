import { ROLE_PRESETS } from "@/constants/rolePresets";

/**
 * Userのロールと認証クレームから、現在のユーザーが持つ全ロールを構築します。
 *
 * @param {object} options
 * @param {Array<string>} [options.roles=[]]
 * @param {boolean} [options.isSuperUser=false]
 * @param {boolean} [options.isDeveloper=false]
 * @param {boolean} [options.isAdmin=false]
 * @returns {Array<string>}
 */
export function buildRoles({
  roles = [],
  isSuperUser = false,
  isDeveloper = false,
  isAdmin = false,
} = {}) {
  const result = Array.isArray(roles) ? [...roles] : [];

  if (isSuperUser) result.push("super-user");
  if (isDeveloper) result.push("developer");
  if (isAdmin) result.push("admin");

  return result;
}

/**
 * ロールを権限一覧へ展開します。
 * write権限がある場合は、対応するread権限も付与します。
 *
 * @param {Array<string>} roles
 * @returns {Array<string>}
 */
export function getPermissions(roles = []) {
  if (!Array.isArray(roles)) {
    return [];
  }

  const permissions = new Set();

  for (const role of roles) {
    if (role === "super-user") {
      return ["*"];
    }

    const preset = ROLE_PRESETS[role];
    if (preset) {
      for (const permission of preset.permissions) {
        permissions.add(permission);
      }
    } else {
      permissions.add(role);
    }
  }

  for (const permission of [...permissions]) {
    if (permission.endsWith(":write")) {
      permissions.add(permission.replace(/:write$/, ":read"));
    }
  }

  return [...permissions];
}

/**
 * 指定されたロールを保持しているか判定します。
 *
 * @param {Array<string>} roles
 * @param {string} role
 * @returns {boolean}
 */
export function hasRole(roles, role) {
  return Array.isArray(roles) && roles.includes(role);
}

/**
 * 指定された権限を保持しているか判定します。
 * ワイルドカード権限を持つ場合は、すべての権限を保持していると判定します。
 *
 * @param {Array<string>} permissions
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(permissions, permission) {
  if (!Array.isArray(permissions)) {
    return false;
  }

  return permissions.includes("*") || permissions.includes(permission);
}
