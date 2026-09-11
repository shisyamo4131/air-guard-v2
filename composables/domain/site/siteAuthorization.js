import {
  ROLE_PRESETS,
  isRolePresetId,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

export const SITE_WRITE_OPERATION = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  CUSTOMER: "customer",
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

function hasValidSiteActor({
  authenticationUid,
  uid,
  companyId,
  isEmailVerified,
  isSuperUser,
  isSuperUserClaimValid,
  user,
} = {}) {
  return typeof authenticationUid === "string" &&
    authenticationUid.length > 0 &&
    typeof uid === "string" &&
    uid.length > 0 &&
    authenticationUid === uid &&
    typeof companyId === "string" &&
    companyId.length > 0 &&
    isEmailVerified === true &&
    isSuperUserClaimValid === true &&
    typeof isSuperUser === "boolean" &&
    Boolean(user) &&
    user.docId === uid &&
    user.companyId === companyId &&
    user.isTemporary === false &&
    user.disabled === false &&
    typeof user.isAdmin === "boolean";
}

/**
 * 通常のSite writeを同一tenantの有効な本登録User境界で判定します。
 * client判定はUX用であり、Firestore Rulesの最終認可を代替しません。
 */
export function getSiteWriteDecision(context = {}) {
  return hasValidSiteActor(context)
    ? { allowed: true, reason: null }
    : { allowed: false, reason: DENIED_REASON };
}

/**
 * 不可逆なSite archiveだけは従来のstrict role preset境界を維持します。
 */
export function getSiteArchiveDecision(context = {}) {
  if (!hasValidSiteActor(context)) {
    return { allowed: false, reason: DENIED_REASON };
  }

  const { isSuperUser, user } = context;

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
