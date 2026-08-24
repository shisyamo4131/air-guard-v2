/*****************************************************************************
 * @file ./utils/auth/policies/userLifecycleUiPolicy.js
 * @description UWB-07 lifecycle UI controlをserver policyと同じ前提で判定します。
 *****************************************************************************/
import { hasPresetPermission } from "../authorization.js";

function isSafeId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function isActiveRegisteredActor({
  companyId,
  actorUid,
  actorUser,
  isSuperUser,
}) {
  return Boolean(
    isSafeId(companyId) &&
      isSafeId(actorUid) &&
      isSuperUser === false &&
      actorUser?.docId === actorUid &&
      actorUser?.companyId === companyId &&
      actorUser?.isTemporary === false &&
      actorUser?.disabled === false,
  );
}

export function canTerminateEmployee({
  companyId,
  actorUid,
  actorUser,
  isSuperUser,
  employee,
  linkedUser = null,
} = {}) {
  if (
    !isActiveRegisteredActor({
      companyId,
      actorUid,
      actorUser,
      isSuperUser,
    }) ||
    !isSafeId(employee?.docId) ||
    employee?.employmentStatus !== "ACTIVE" ||
    actorUser.employeeId === employee.docId ||
    linkedUser?.isAdmin === true
  ) {
    return false;
  }
  return Boolean(
    actorUser.isAdmin === true ||
      hasPresetPermission(actorUser.roles, "employees:terminate"),
  );
}

export function canReinstateEmployee({
  companyId,
  actorUid,
  actorUser,
  isSuperUser,
  employee,
} = {}) {
  return Boolean(
    isActiveRegisteredActor({
      companyId,
      actorUid,
      actorUser,
      isSuperUser,
    }) &&
      actorUser.isAdmin === true &&
      isSafeId(employee?.docId) &&
      employee?.employmentStatus === "RESIGNED",
  );
}

export function canDeleteStandaloneRegisteredUser({
  companyId,
  actorUid,
  actorUser,
  isSuperUser,
  targetUser,
} = {}) {
  return Boolean(
    isActiveRegisteredActor({
      companyId,
      actorUid,
      actorUser,
      isSuperUser,
    }) &&
      actorUser.isAdmin === true &&
      isSafeId(targetUser?.docId) &&
      targetUser.docId !== actorUid &&
      targetUser.companyId === companyId &&
      targetUser.isTemporary === false &&
      targetUser.isAdmin === false &&
      (targetUser.employeeId === null || targetUser.employeeId === undefined),
  );
}
