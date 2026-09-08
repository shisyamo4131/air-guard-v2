/**
 * このmoduleはroute・navigationのclient UX gateです。
 * client stateは改変や陳腐化が可能なため、server側の認証・認可を代替しません。
 */
import { isRolePresetId } from "@shisyamo4131/air-guard-v2-schemas/constants";
import {
  getPermissions,
  hasPresetPermission,
} from "../authorization.js";
import { canViewLifecycleOperationHistory } from "./userLifecycleUiPolicy.js";
import { employeeAllowed } from "../../../functions/shared/employeeContract.js";

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
  LIFECYCLE_HISTORY: createPolicy("lifecycle-history"),
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

function hasAccess(requiredRoles, accessContext) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (accessContext.isAdmin === true) {
    return true;
  }

  if (
    accessContext.isSuperUserClaimValid === true &&
    accessContext.isSuperUser === true
  ) {
    return true;
  }

  const actorRoles = accessContext.presetRoles;
  if (!Array.isArray(actorRoles) || actorRoles.length === 0) return false;

  const userPermissions = getPermissions(actorRoles);
  return requiredRoles.some(
    (required) =>
      actorRoles.includes(required) || userPermissions.includes(required),
  );
}

function hasValidUserManagementContext(accessContext) {
  return Boolean(
    accessContext &&
      typeof accessContext === "object" &&
      Array.isArray(accessContext.presetRoles) &&
      accessContext.presetRoles.every((role) => isRolePresetId(role)) &&
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

  if (policy === PAGE_ACCESS_POLICIES.PUBLIC) {
    return true;
  }

  if (policy === PAGE_ACCESS_POLICIES.AUTHENTICATED) {
    return accessContext?.isAuthenticated === true;
  }

  if (accessContext?.isActiveRegisteredActor !== true) {
    return false;
  }

  if (policy === PAGE_ACCESS_POLICIES.SUPER_USER) {
    return Boolean(
      accessContext.isSuperUserClaimValid === true &&
        accessContext.isSuperUser === true,
    );
  }

  if (policy === PAGE_ACCESS_POLICIES.DEVELOPER) {
    return Boolean(
      accessContext.isDeveloperClaimValid === true &&
        accessContext.isDeveloper === true,
    );
  }

  if (policy === PAGE_ACCESS_POLICIES.ADMIN) {
    return Boolean(
      accessContext.isAdmin === true ||
        (accessContext.isSuperUserClaimValid === true &&
          accessContext.isSuperUser === true),
    );
  }

  if (policy === PAGE_ACCESS_POLICIES.EMPLOYEES_READ) {
    return Boolean(
      accessContext.isSuperUserClaimValid === true &&
        employeeAllowed(
          {
            uid: accessContext.actorUid,
            companyId: accessContext.companyId,
            isSuperUser: accessContext.isSuperUser,
            actorUser: accessContext.actorUser,
          },
          false,
        ),
    );
  }

  if (policy === PAGE_ACCESS_POLICIES.USER_MANAGEMENT) {
    if (
      accessContext.isSuperUser !== false ||
      !hasValidUserManagementContext(accessContext)
    ) {
      return false;
    }

    return (
      accessContext.isAdmin === true ||
      hasPresetPermission(accessContext.presetRoles, "users:write")
    );
  }

  if (policy === PAGE_ACCESS_POLICIES.LIFECYCLE_HISTORY) {
    return canViewLifecycleOperationHistory({
      companyId: accessContext.companyId,
      actorUid: accessContext.actorUid,
      actorUser: accessContext.actorUser,
      isSuperUser: accessContext.isSuperUser,
    });
  }

  return hasAccess(policy.requiredRoles, accessContext);
}
