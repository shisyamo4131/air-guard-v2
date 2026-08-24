/*****************************************************************************
 * @file ./composables/application/user/useUserFieldUpdates.js
 * @description User field別更新のclient application境界です。
 *****************************************************************************/
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  canManageUserFields as evaluateCanManageUserFields,
  canUpdateUserRoles as evaluateCanUpdateUserRoles,
  createNotificationSettingsPayload,
  createRolesPayload,
} from "@/utils/auth/policies/userFieldUpdatePolicy";

export function useUserFieldUpdates() {
  const auth = useAuthStore();
  const {
    updateOwnUserProfile,
    updateUserNotificationSettings,
    updateUserRoles,
  } = useAuthFunctions();

  function canManageUserFields() {
    return evaluateCanManageUserFields({
      isAdmin: auth.isAdmin,
      hasUsersWrite: auth.hasPresetPermission("users:write"),
    });
  }

  function canUpdateUserRoles(targetUser) {
    return evaluateCanUpdateUserRoles({
      actorUid: auth.uid,
      isAdmin: auth.isAdmin,
      hasUsersWrite: auth.hasPresetPermission("users:write"),
      targetUser,
    });
  }

  async function updateOwnProfile({ displayName, tagSize }) {
    return updateOwnUserProfile({ displayName, tagSize });
  }

  async function updateManagedUser(targetUser) {
    if (!canManageUserFields()) {
      throw new Error("User fields cannot be managed by the current actor.");
    }

    await updateUserNotificationSettings(
      createNotificationSettingsPayload(targetUser),
    );
    if (canUpdateUserRoles(targetUser)) {
      await updateUserRoles(createRolesPayload(targetUser));
    }
  }

  return {
    canManageUserFields,
    canUpdateUserRoles,
    updateOwnProfile,
    updateManagedUser,
  };
}
