/*****************************************************************************
 * @file ./utils/auth/policies/userFieldUpdatePolicy.js
 * @description User field別更新のclient表示・transport policyです。
 *****************************************************************************/
export const USER_NOTIFICATION_FIELDS = Object.freeze([
  "receiveConfirmedArrangementNotification",
  "receiveArrivedArrangementNotification",
  "receiveLeavedArrangementNotification",
]);

export function canManageUserFields({ isAdmin, hasUsersWrite } = {}) {
  return isAdmin === true || hasUsersWrite === true;
}

export function canUpdateUserRoles({
  actorUid,
  isAdmin,
  hasUsersWrite,
  targetUser,
} = {}) {
  return Boolean(
    canManageUserFields({ isAdmin, hasUsersWrite }) &&
      targetUser?.docId &&
      targetUser.docId !== actorUid &&
      targetUser.isAdmin === false,
  );
}

export function createNotificationSettingsPayload(targetUser) {
  return {
    targetUserId: targetUser.docId,
    ...Object.fromEntries(
      USER_NOTIFICATION_FIELDS.map((field) => [field, targetUser[field]]),
    ),
  };
}

export function createRolesPayload(targetUser) {
  if (!Array.isArray(targetUser?._beforeData?.roles)) {
    throw new Error("Original User roles are unavailable.");
  }
  return {
    targetUserId: targetUser.docId,
    expectedRoles: [...targetUser._beforeData.roles],
    roles: [...targetUser.roles],
  };
}
