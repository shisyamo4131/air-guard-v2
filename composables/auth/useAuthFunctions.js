import { httpsCallable } from "firebase/functions";

export const useAuthFunctions = () => {
  const { $functions } = useNuxtApp();

  /**
   * メールアドレスが利用可能かをチェックします。
   * - isAdminフラグに基づき、管理者登録または利用者登録用としてチェックします。
   * @param {Object} data
   * @param {string} data.email - メールアドレス
   * @param {boolean} data.isAdmin - 管理者フラグ
   * @returns {Promise<{available: boolean}>}
   */
  const checkEmailAvailability = async (data) => {
    const callable = httpsCallable($functions, "checkEmailAvailability");
    const result = await callable(data);
    return result.data;
  };

  /**
   * 管理者アカウント作成
   * @param {Object} data
   * @param {string} data.companyName - 会社名
   * @param {string} data.companyNameKana - 会社名カナ
   * @param {string} data.displayName - 表示名
   * @returns {Promise<{success: boolean, companyId: string, userId: string}>}
   */
  const createAdminAccount = async (data) => {
    const callable = httpsCallable($functions, "createAdminAccount");
    const result = await callable(data);
    return result.data;
  };

  /**
   * ユーザー事前登録確認
   * @param {Object} data
   * @param {string} data.email - メールアドレス
   * @returns {Promise<{isPreRegistered: boolean, companyId?: string, displayName?: string, roles?: Array, tempUserId?: string}>}
   */
  const checkUserPreRegistration = async (data) => {
    const callable = httpsCallable($functions, "checkUserPreRegistration");
    const result = await callable(data);
    return result.data;
  };

  /**
   * 利用者アカウント作成
   * @param {Object} data
   * @param {string} data.companyId - 会社ID
   * @param {string} data.tempUserId - 仮ユーザードキュメントID
   * @returns {Promise<{success: boolean}>}
   */
  const setupUserAccount = async (data) => {
    const callable = httpsCallable($functions, "setupUserAccount");
    const result = await callable(data);
    return result.data;
  };

  /**
   * アカウント無効化
   * @param {Object} data
   * @param {string} data.uid - ユーザーID
   * @returns {Promise<{success: boolean, uid: string}>}
   */
  const disableUser = async (data) => {
    const callable = httpsCallable($functions, "disableUser");
    const result = await callable(data);
    return result.data;
  };

  /**
   * アカウント有効化
   * @param {Object} data
   * @param {string} data.uid - ユーザーID
   * @returns {Promise<{success: boolean, uid: string}>}
   */
  const enableUser = async (data) => {
    const callable = httpsCallable($functions, "enableUser");
    const result = await callable(data);
    return result.data;
  };

  /**
   * 管理者変更
   * @param {Object} data
   * @param {string} data.from - 現在の管理者ユーザーID
   * @param {string} data.to - 新しい管理者ユーザーID
   * @returns {Promise<{success: boolean, from: string, to: string}>}
   */
  const changeAdminUser = async (data) => {
    const callable = httpsCallable($functions, "changeAdminUser");
    const result = await callable(data);
    return result.data;
  };

  return {
    checkEmailAvailability,
    createAdminAccount,
    checkUserPreRegistration,
    setupUserAccount,
    disableUser,
    enableUser,
    changeAdminUser,
  };
};
