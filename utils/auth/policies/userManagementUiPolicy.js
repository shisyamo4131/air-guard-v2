/*****************************************************************************
 * @file ./utils/auth/policies/userManagementUiPolicy.js
 * @description User管理UI controlをserver認可と同じ前提でfail-closed判定します。
 *****************************************************************************/

function isSafeId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function isActiveRegisteredUser(user, companyId) {
  return Boolean(
    user &&
      typeof user === "object" &&
      user.companyId === companyId &&
      user.isTemporary === false &&
      user.disabled === false,
  );
}

export function canChangeUserEnabledState({
  companyId,
  actorUid,
  actorUser,
  targetUser,
} = {}) {
  return Boolean(
    isSafeId(companyId) &&
      isSafeId(actorUid) &&
      isActiveRegisteredUser(actorUser, companyId) &&
      actorUser.docId === actorUid &&
      actorUser.isAdmin === true &&
      isSafeId(targetUser?.docId) &&
      targetUser.docId !== actorUid &&
      targetUser.companyId === companyId &&
      targetUser.isTemporary === false &&
      typeof targetUser.disabled === "boolean" &&
      targetUser.isAdmin === false,
  );
}

export function canTransferCompanyAdmin({
  companyId,
  actorUid,
  actorUser,
} = {}) {
  return Boolean(
    isSafeId(companyId) &&
      isSafeId(actorUid) &&
      isActiveRegisteredUser(actorUser, companyId) &&
      actorUser.docId === actorUid &&
      actorUser.isAdmin === true,
  );
}
