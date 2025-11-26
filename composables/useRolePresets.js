// composables/useRolePresets.js

export const ROLE_PRESETS = {
  manager: {
    label: "部長・所長",
    description: "統括管理",
    icon: "mdi-hammer-wrench",
    permissions: [
      "customers:write",
      "sites:write",
      "employees:write",
      "outsourcers:write",
      "site-operation-schedules:write",
      "operation-results:write",
      "billings:write",
    ],
  },
  controller: {
    label: "管制",
    description: "現場・スケジュール管理",
    icon: "mdi-hammer-wrench",
    permissions: [
      "customers:read",
      "sites:write",
      "employees:read",
      "outsourcers:read",
      "site-operation-schedules:write",
      "operation-results:write",
    ],
  },
  accountant: {
    label: "経理",
    description: "請求・集計管理",
    icon: "mdi-calculator",
    permissions: [
      "customers:read",
      "sites:read",
      "employees:read",
      "outsourcers:read",
      "operation-results:read",
      "operation-billings:write",
      "billings:write",
    ],
  },
  "human-resource": {
    label: "人事",
    description: "人事管理",
    icon: "mdi-account-tie",
    permissions: [
      "customers:read",
      "sites:read",
      "employees:write",
      "operation-results:read",
    ],
  },
  labor: {
    label: "労務",
    description: "労務管理",
    icon: "mdi-clipboard-account",
    permissions: [
      "customers:read",
      "sites:read",
      "employees:read",
      "operation-results:read",
    ],
  },
  legal: {
    label: "法務",
    description: "契約管理",
    icon: "mdi-gavel",
    permissions: ["customers:write", "sites:write", "employees:read"],
  },
};

export function useRolePresets() {
  /**
   * 役割から権限リストを取得
   * - write 権限がある場合、自動的に read 権限も付与
   *
   * @param {Array<string>} roles - ユーザーの役割配列
   * @returns {Array<string>} 権限の配列
   *
   * @example
   * getPermissions(['sites:write'])
   * // → ["sites:write", "sites:read"]
   *
   * getPermissions(['controller'])
   * // → ["customers:read", "sites:read", "sites:write", ...]
   */
  function getPermissions(roles = []) {
    const permissions = new Set();

    for (const role of roles) {
      // admin と super-user は特別扱い
      if (role === "admin" || role === "super-user") {
        return ["*"]; // すべての権限
      }

      // プリセット役割の権限を追加
      const preset = ROLE_PRESETS[role];
      if (preset) {
        preset.permissions.forEach((p) => permissions.add(p));
      } else {
        // プリセットにない場合は、そのまま権限として追加（機能単位の権限）
        permissions.add(role);
      }
    }

    // ===== 追加: write → read の自動付与 =====
    const permissionsArray = Array.from(permissions);
    const additionalPermissions = [];

    for (const permission of permissionsArray) {
      // "xxx:write" の形式の場合、"xxx:read" を自動追加
      if (permission.endsWith(":write")) {
        const readPermission = permission.replace(":write", ":read");
        if (!permissions.has(readPermission)) {
          additionalPermissions.push(readPermission);
        }
      }
    }

    // 追加の権限をマージ
    additionalPermissions.forEach((p) => permissions.add(p));

    return Array.from(permissions);
  }

  return {
    ROLE_PRESETS,
    getPermissions,
  };
}
