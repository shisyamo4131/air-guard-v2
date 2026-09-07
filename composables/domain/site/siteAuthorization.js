import {
  ROLE_PRESETS,
  isRolePresetId,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

export const SITE_WRITE_OPERATION = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  CUSTOMER: "customer",
  AGREEMENT: "agreement",
  TERMINATE: "terminate",
});

export class SiteAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SiteAuthorizationError";
    this.code = code;
  }
}

const DENIED_REASON = "現場を変更する権限を確認できません。";

/**
 * Site write actorをstrict role preset境界で判定します。
 * client判定はUX用であり、Firestore Rulesの最終認可を代替しません。
 */
export function getSiteWriteDecision({
  authenticationUid,
  uid,
  companyId,
  isEmailVerified,
  isSuperUser,
  isSuperUserClaimValid,
  user,
} = {}) {
  if (
    typeof authenticationUid !== "string" ||
    !authenticationUid ||
    typeof uid !== "string" ||
    !uid ||
    authenticationUid !== uid ||
    typeof companyId !== "string" ||
    !companyId ||
    isEmailVerified !== true ||
    isSuperUserClaimValid !== true ||
    typeof isSuperUser !== "boolean" ||
    !user ||
    user.docId !== uid ||
    user.companyId !== companyId ||
    user.isTemporary !== false ||
    user.disabled !== false ||
    typeof user.isAdmin !== "boolean"
  ) {
    return { allowed: false, reason: DENIED_REASON };
  }

  if (user.isAdmin === true) return { allowed: true, reason: null };

  if (
    isSuperUser !== false ||
    !Array.isArray(user.roles) ||
    !user.roles.every(isRolePresetId)
  ) {
    return { allowed: false, reason: DENIED_REASON };
  }

  const hasSitesWrite = user.roles.some((role) =>
    ROLE_PRESETS[role]?.permissions.includes("sites:write"),
  );

  return hasSitesWrite
    ? { allowed: true, reason: null }
    : { allowed: false, reason: DENIED_REASON };
}

export function assertSiteWriteAllowed(context) {
  const decision = getSiteWriteDecision(context);
  if (!decision.allowed) {
    throw new SiteAuthorizationError("permission-denied", decision.reason);
  }
}
