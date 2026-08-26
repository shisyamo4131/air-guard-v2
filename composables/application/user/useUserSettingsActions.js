/*****************************************************************************
 * @file ./composables/application/user/useUserSettingsActions.js
 * @description ユーザー設定に関するアクションを提供するコンポーザブル
 *****************************************************************************/
import { useAuthStore } from "@/stores/useAuthStore";
import { useUserFieldUpdates } from "@/composables/application/user/useUserFieldUpdates";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

export function useUserSettingsActions() {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();
  const { updateOwnProfile } = useUserFieldUpdates();

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * ユーザー規定のタグサイズを設定します。
   * @param {string} tagSize
   */
  async function updateTagSize(tagSize) {
    if (!TAG_SIZE_VALUES[tagSize]) {
      throw new Error(`Invalid tag size: ${tagSize}`);
    }

    await updateOwnProfile({
      displayName: auth.user.displayName,
      tagSize,
    });
  }

  async function updateProfile({ displayName, tagSize }) {
    if (!TAG_SIZE_VALUES[tagSize]) {
      throw new Error(`Invalid tag size: ${tagSize}`);
    }
    return updateOwnProfile({ displayName, tagSize });
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    updateTagSize,
    updateProfile,
  };
}
