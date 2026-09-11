import {
  ROLE_PRESETS,
  isRolePresetId,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

export const CUSTOMER_BASIC_FIELDS = Object.freeze([
  "code",
  "name",
  "branchName",
  "abbreviation",
  "nameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "tel",
  "fax",
  "contractStatus",
  "remarks",
]);

export const CUSTOMER_PAYMENT_FIELDS = Object.freeze([
  "cutoffDate",
  "paymentMonth",
  "paymentDate",
]);

export function getCustomerWriteDecision({
  uid,
  companyId,
  isSuperUser,
  isSuperUserClaimValid,
  user,
} = {}) {
  if (
    typeof uid !== "string" ||
    !uid ||
    typeof companyId !== "string" ||
    !companyId ||
    isSuperUserClaimValid !== true ||
    typeof isSuperUser !== "boolean" ||
    !user ||
    user.companyId !== companyId ||
    user.isTemporary !== false ||
    user.disabled !== false
  ) {
    return {
      allowed: false,
      reason: "取引先を変更する権限を確認できません。",
    };
  }

  if (user.isAdmin === true) return { allowed: true, reason: null };
  if (isSuperUser !== false || !Array.isArray(user.roles)) {
    return {
      allowed: false,
      reason: "取引先を変更する権限がありません。",
    };
  }

  const knownPresets = user.roles.every(isRolePresetId);
  const hasWritePreset = user.roles.some((role) =>
    ROLE_PRESETS[role]?.permissions.includes("customers:write"),
  );
  return knownPresets && hasWritePreset
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "取引先を変更する権限がありません。" };
}
