/**
 * このmoduleはroute・navigationのclient UX gateです。
 * client stateは改変や陳腐化が可能なため、server側の認証・認可を代替しません。
 */
import { ROLE_PRESETS } from "../../../constants/rolePresets.js";
import {
  getPermissions,
  hasPresetPermission,
} from "../authorization.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function createPolicy(id, requiredRoles = []) {
  return deepFreeze({ id, requiredRoles });
}

export const PAGE_ACCESS_POLICIES = deepFreeze({
  PUBLIC: createPolicy("public"),
  AUTHENTICATED: createPolicy("authenticated"),
  SUPER_USER: createPolicy("super-user", ["super-user"]),
  DEVELOPER: createPolicy("developer", ["developer"]),
  ADMIN: createPolicy("admin", ["admin"]),
  SITE_OPERATION_SCHEDULES_READ: createPolicy(
    "site-operation-schedules-read",
    ["site-operation-schedules:read"],
  ),
  OPERATION_RESULTS_READ: createPolicy("operation-results-read", [
    "operation-results:read",
  ]),
  BILLINGS_READ: createPolicy("billings-read", ["billings:read"]),
  CUSTOMERS_READ: createPolicy("customers-read", ["customers:read"]),
  SITES_READ: createPolicy("sites-read", ["sites:read"]),
  EMPLOYEES_READ: createPolicy("employees-read", ["employees:read"]),
  OUTSOURCERS_READ: createPolicy("outsourcers-read", [
    "outsourcers:read",
  ]),
  USER_MANAGEMENT: createPolicy("user-management"),
});

const knownPolicies = new Set(Object.values(PAGE_ACCESS_POLICIES));

/**
 * Catalogで共有されるpolicy descriptorかを判定します。
 * 同じfieldを持つだけのinline objectは既知policyとして扱いません。
 */
export function isKnownPageAccessPolicy(policy) {
  return knownPolicies.has(policy);
}

export function isPublicPageAccessPolicy(policy) {
  return policy === PAGE_ACCESS_POLICIES.PUBLIC;
}

function hasAccess(requiredRoles, userRoles) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  if (
    requiredRoles.includes("super-user") &&
    !userRoles.includes("super-user")
  ) {
    return false;
  }

  if (requiredRoles.includes("developer") && !userRoles.includes("developer")) {
    return false;
  }

  if (userRoles.includes("admin")) {
    return true;
  }

  const userPermissions = getPermissions(userRoles);
  if (userPermissions.includes("*")) {
    return true;
  }

  return requiredRoles.some(
    (required) =>
      userRoles.includes(required) || userPermissions.includes(required),
  );
}

function hasValidUserManagementContext(accessContext) {
  return Boolean(
    accessContext &&
      typeof accessContext === "object" &&
      Array.isArray(accessContext.presetRoles) &&
      accessContext.presetRoles.every(
        (role) =>
          typeof role === "string" && Object.hasOwn(ROLE_PRESETS, role),
      ) &&
      typeof accessContext.isAdmin === "boolean",
  );
}

/**
 * VueやNuxtへ依存せず、page policy単体のアクセス可否を判定します。
 */
export function isPageAccessAllowed(
  policy,
  userRoles,
  accessContext = {},
) {
  if (!isKnownPageAccessPolicy(policy)) {
    return false;
  }

  if (
    policy === PAGE_ACCESS_POLICIES.PUBLIC ||
    policy === PAGE_ACCESS_POLICIES.AUTHENTICATED
  ) {
    return true;
  }

  if (policy === PAGE_ACCESS_POLICIES.USER_MANAGEMENT) {
    if (!hasValidUserManagementContext(accessContext)) {
      return false;
    }

    return (
      accessContext.isAdmin === true ||
      hasPresetPermission(accessContext.presetRoles, "users:write")
    );
  }

  return hasAccess(policy.requiredRoles, userRoles);
}
