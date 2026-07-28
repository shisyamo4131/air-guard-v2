/*****************************************************************************
 * @file ./composables/application/user/useUserSettingsActions.js
 * @description ユーザー設定に関するアクションを提供するコンポーザブル
 *****************************************************************************/
import { useAuthStore } from "@/stores/useAuthStore";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

export function useUserSettingsActions() {
  /*****************************************************************************
   * SETUP STORES
   *****************************************************************************/
  const auth = useAuthStore();

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

    await auth.user.updateProperties({ tagSize });
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    updateTagSize,
  };
}
