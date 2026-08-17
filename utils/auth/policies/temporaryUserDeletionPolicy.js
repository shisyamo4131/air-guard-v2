import { ROLE_PRESETS } from "../../../constants/rolePresets.js";
import { hasPresetPermission } from "../authorization.js";

export const CLIENT_TEMPORARY_USER_DELETION_REASONS = Object.freeze({
  COMPANY_ID_INVALID: "company-id-invalid",
  ACTOR_INVALID: "actor-invalid",
  ACTOR_COMPANY_MISMATCH: "actor-company-mismatch",
  ACTOR_TEMPORARY_STATE_INVALID: "actor-temporary-state-invalid",
  ACTOR_NOT_REGISTERED: "actor-not-registered",
  ACTOR_DISABLED_STATE_INVALID: "actor-disabled-state-invalid",
  ACTOR_NOT_ACTIVE: "actor-not-active",
  ACTOR_ADMIN_STATE_INVALID: "actor-admin-state-invalid",
  ACTOR_ROLES_INVALID: "actor-roles-invalid",
  ACTOR_PERMISSION_DENIED: "actor-permission-denied",
  TARGET_INVALID: "target-invalid",
  TARGET_ID_INVALID: "target-id-invalid",
  TARGET_COMPANY_MISMATCH: "target-company-mismatch",
  TARGET_TEMPORARY_STATE_INVALID: "target-temporary-state-invalid",
  TARGET_NOT_TEMPORARY: "target-not-temporary",
  TARGET_ADMIN_STATE_INVALID: "target-admin-state-invalid",
  TARGET_IS_ADMIN: "target-is-admin",
  TARGET_DISABLED_STATE_INVALID: "target-disabled-state-invalid",
  TARGET_NOT_ACTIVE: "target-not-active",
  TARGET_EMPLOYEE_ID_INVALID: "target-employee-id-invalid",
  EMPLOYEE_CONTEXT_ID_INVALID: "employee-context-id-invalid",
  TARGET_EMPLOYEE_MISMATCH: "target-employee-mismatch",
});

function deny(reason) {
  return { allowed: false, reason };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDocumentId(value) {
  return (
    typeof value === "string" &&
    Boolean(value) &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function hasValidPresetRoles(roles) {
  return (
    Array.isArray(roles) &&
    roles.every(
      (role) =>
        typeof role === "string" &&
        Boolean(role) &&
        Object.hasOwn(ROLE_PRESETS, role),
    )
  );
}

/**
 * clientが保持する状態から、仮登録User削除操作の事前可否を判定します。
 * serverの最終認可を代替せず、UIとrequest送信前のfail-closed判定に使用します。
 *
 * @param {Object} param
 * @param {string} param.companyId
 * @param {Object} param.actorUser
 * @param {Object} param.targetUser
 * @param {string} [param.employeeId]
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function evaluateClientTemporaryUserDeletion({
  companyId,
  actorUser,
  targetUser,
  employeeId,
} = {}) {
  if (!isValidDocumentId(companyId)) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.COMPANY_ID_INVALID);
  }

  if (!isObject(actorUser)) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_INVALID);
  }
  if (actorUser.companyId !== companyId) {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_COMPANY_MISMATCH,
    );
  }
  if (typeof actorUser.isTemporary !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_TEMPORARY_STATE_INVALID,
    );
  }
  if (actorUser.isTemporary !== false) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_NOT_REGISTERED);
  }
  if (typeof actorUser.disabled !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_DISABLED_STATE_INVALID,
    );
  }
  if (actorUser.disabled !== false) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_NOT_ACTIVE);
  }
  if (typeof actorUser.isAdmin !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_ADMIN_STATE_INVALID,
    );
  }
  if (!hasValidPresetRoles(actorUser.roles)) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_ROLES_INVALID);
  }
  if (
    actorUser.isAdmin !== true &&
    !hasPresetPermission(actorUser.roles, "users:write")
  ) {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.ACTOR_PERMISSION_DENIED,
    );
  }

  if (!isObject(targetUser)) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_INVALID);
  }
  if (!isValidDocumentId(targetUser.docId)) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_ID_INVALID);
  }
  if (targetUser.companyId !== companyId) {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_COMPANY_MISMATCH,
    );
  }
  if (typeof targetUser.isTemporary !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_TEMPORARY_STATE_INVALID,
    );
  }
  if (targetUser.isTemporary !== true) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_NOT_TEMPORARY);
  }
  if (typeof targetUser.isAdmin !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_ADMIN_STATE_INVALID,
    );
  }
  if (targetUser.isAdmin !== false) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_IS_ADMIN);
  }
  if (typeof targetUser.disabled !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_DISABLED_STATE_INVALID,
    );
  }
  if (targetUser.disabled !== false) {
    return deny(CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_NOT_ACTIVE);
  }

  const targetEmployeeId = targetUser.employeeId;
  if (
    targetEmployeeId !== undefined &&
    targetEmployeeId !== null &&
    (typeof targetEmployeeId !== "string" ||
      (targetEmployeeId.length > 0 &&
        !isValidDocumentId(targetEmployeeId)))
  ) {
    return deny(
      CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_EMPLOYEE_ID_INVALID,
    );
  }

  if (employeeId !== undefined) {
    if (!isValidDocumentId(employeeId)) {
      return deny(
        CLIENT_TEMPORARY_USER_DELETION_REASONS.EMPLOYEE_CONTEXT_ID_INVALID,
      );
    }
    if (targetEmployeeId !== employeeId) {
      return deny(
        CLIENT_TEMPORARY_USER_DELETION_REASONS.TARGET_EMPLOYEE_MISMATCH,
      );
    }
  }

  return { allowed: true, reason: null };
}
