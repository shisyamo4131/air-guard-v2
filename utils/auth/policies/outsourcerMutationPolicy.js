import { isRolePresetId } from "@shisyamo4131/air-guard-v2-schemas/constants";

export const OUTSOURCER_MUTATIONS = Object.freeze({
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
});

export const OUTSOURCER_MUTATION_REASONS = Object.freeze({
  INVALID_OPERATION: "invalid-operation",
  DELETE_DENIED: "delete-denied",
  IDENTITY_INVALID: "identity-invalid",
  ACTOR_INVALID: "actor-invalid",
  ACTOR_UID_MISMATCH: "actor-uid-mismatch",
  ACTOR_COMPANY_MISMATCH: "actor-company-mismatch",
  ACTOR_NOT_REGISTERED: "actor-not-registered",
  ACTOR_NOT_ACTIVE: "actor-not-active",
  ACTOR_ADMIN_STATE_INVALID: "actor-admin-state-invalid",
  ACTOR_ROLES_INVALID: "actor-roles-invalid",
  ACTOR_PERMISSION_DENIED: "actor-permission-denied",
});

function deny(reason) {
  return {
    allowed: false,
    reason,
    message: "外注先を変更する権限がありません。",
  };
}

function isSafeIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function hasExactManagerRole(roles) {
  return (
    Array.isArray(roles) &&
    roles.length === 1 &&
    roles[0] === "manager" &&
    isRolePresetId(roles[0])
  );
}

/**
 * Outsourcerのcreate/update送信直前とUI表示に使うfail-closed policyです。
 * Firestore Rulesの最終認可を代替しません。
 */
export function evaluateOutsourcerMutation({
  operation,
  uid,
  companyId,
  isSuperUser,
  isSuperUserClaimValid,
  actorUser,
} = {}) {
  if (!Object.values(OUTSOURCER_MUTATIONS).includes(operation)) {
    return deny(OUTSOURCER_MUTATION_REASONS.INVALID_OPERATION);
  }
  if (operation === OUTSOURCER_MUTATIONS.DELETE) {
    return deny(OUTSOURCER_MUTATION_REASONS.DELETE_DENIED);
  }
  if (
    !isSafeIdentifier(uid) ||
    !isSafeIdentifier(companyId) ||
    isSuperUserClaimValid !== true ||
    typeof isSuperUser !== "boolean"
  ) {
    return deny(OUTSOURCER_MUTATION_REASONS.IDENTITY_INVALID);
  }
  if (!actorUser || typeof actorUser !== "object" || Array.isArray(actorUser)) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_INVALID);
  }
  if (!isSafeIdentifier(actorUser.docId) || actorUser.docId !== uid) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_UID_MISMATCH);
  }
  if (actorUser.companyId !== companyId) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_COMPANY_MISMATCH);
  }
  if (actorUser.isTemporary !== false) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_NOT_REGISTERED);
  }
  if (actorUser.disabled !== false) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_NOT_ACTIVE);
  }
  if (typeof actorUser.isAdmin !== "boolean") {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_ADMIN_STATE_INVALID);
  }
  if (actorUser.isAdmin === true) {
    return { allowed: true, reason: null, message: null };
  }
  if (!Array.isArray(actorUser.roles)) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_ROLES_INVALID);
  }
  if (isSuperUser !== false || !hasExactManagerRole(actorUser.roles)) {
    return deny(OUTSOURCER_MUTATION_REASONS.ACTOR_PERMISSION_DENIED);
  }
  return { allowed: true, reason: null, message: null };
}
