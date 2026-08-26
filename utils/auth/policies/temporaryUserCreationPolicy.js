import { isRolePresetId } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { hasPresetPermission } from "../authorization.js";

export const CLIENT_TEMPORARY_USER_CREATION_REASONS = Object.freeze({
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
});

function deny(reason) {
  return { allowed: false, reason };
}

function isValidDocumentId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function hasValidPresetRoles(roles) {
  return (
    Array.isArray(roles) &&
    roles.every((role) => isRolePresetId(role))
  );
}

/**
 * UI表示と送信直前確認に使うfail-closedな仮登録User作成policyです。
 * Callable側の最終認可は必ず別途実行されます。
 */
export function evaluateClientTemporaryUserCreation({
  companyId,
  actorUser,
} = {}) {
  if (!isValidDocumentId(companyId)) {
    return deny(CLIENT_TEMPORARY_USER_CREATION_REASONS.COMPANY_ID_INVALID);
  }
  if (!actorUser || typeof actorUser !== "object" || Array.isArray(actorUser)) {
    return deny(CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_INVALID);
  }
  if (actorUser.companyId !== companyId) {
    return deny(
      CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_COMPANY_MISMATCH,
    );
  }
  if (typeof actorUser.isTemporary !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_TEMPORARY_STATE_INVALID,
    );
  }
  if (actorUser.isTemporary) {
    return deny(CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_NOT_REGISTERED);
  }
  if (typeof actorUser.disabled !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_DISABLED_STATE_INVALID,
    );
  }
  if (actorUser.disabled) {
    return deny(CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_NOT_ACTIVE);
  }
  if (typeof actorUser.isAdmin !== "boolean") {
    return deny(
      CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_ADMIN_STATE_INVALID,
    );
  }
  if (!hasValidPresetRoles(actorUser.roles)) {
    return deny(CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_ROLES_INVALID);
  }
  if (
    !actorUser.isAdmin &&
    !hasPresetPermission(actorUser.roles, "users:provision")
  ) {
    return deny(
      CLIENT_TEMPORARY_USER_CREATION_REASONS.ACTOR_PERMISSION_DENIED,
    );
  }
  return {
    allowed: true,
    reason: null,
    canAssignRoles:
      actorUser.isAdmin ||
      hasPresetPermission(actorUser.roles, "users:write"),
  };
}
