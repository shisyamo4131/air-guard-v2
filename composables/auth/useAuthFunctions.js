import { httpsCallable } from "firebase/functions";

export const useAuthFunctions = () => {
  const { $functions } = useNuxtApp();

  /**
   * 管理者サインアップ前にメールアドレスが利用可能かをチェックします。
   * @param {Object} data
   * @param {string} data.email - メールアドレス
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
   * @returns {Promise<{isPreRegistered: boolean}>}
   */
  const checkUserPreRegistration = async (data) => {
    const callable = httpsCallable($functions, "checkUserPreRegistration");
    const result = await callable(data);
    return result.data;
  };

  /**
   * 利用者アカウント作成
   * Authenticationの確認済みメールアドレスからserver側で仮登録を解決します。
   * @returns {Promise<{success: boolean, companyId: string, userId: string}>}
   */
  const setupUserAccount = async () => {
    const callable = httpsCallable($functions, "setupUserAccount");
    const result = await callable();
    return result.data;
  };

  /** 仮登録の単独Userを作成します。 */
  const createStandaloneTemporaryUser = async (data) => {
    const callable = httpsCallable(
      $functions,
      "createStandaloneTemporaryUser",
    );
    const result = await callable(data);
    return result.data;
  };

  /** Employeeに紐づく仮登録Userを作成します。 */
  const createEmployeeLinkedTemporaryUser = async (data) => {
    const callable = httpsCallable(
      $functions,
      "createEmployeeLinkedTemporaryUser",
    );
    const result = await callable(data);
    return result.data;
  };

  /**
   * 仮登録Userを削除します。
   * @param {string} targetUserId - 削除対象の仮登録User ID
   * @returns {Promise<{
   *   success: boolean,
   *   userId: string,
   *   linkType: "standalone" | "employee-linked",
   *   employeeId: string | null,
   * }>}
   */
  const deleteTemporaryUser = async (targetUserId) => {
    const callable = httpsCallable($functions, "deleteTemporaryUser");
    const result = await callable({ targetUserId });
    return result.data;
  };

  /** 従業員を退職状態へ遷移させます。 */
  const terminateEmployee = async (data) => {
    const callable = httpsCallable($functions, "terminateEmployee");
    const result = await callable(data);
    return result.data;
  };

  /** 単独本登録Userを物理削除します。 */
  const deleteStandaloneRegisteredUser = async (data) => {
    const callable = httpsCallable(
      $functions,
      "deleteStandaloneRegisteredUser",
    );
    const result = await callable(data);
    return result.data;
  };

  /** 誤退職訂正に必要な最小contextを取得します。 */
  const getEmployeeReinstatementContext = async (data) => {
    const callable = httpsCallable(
      $functions,
      "getEmployeeReinstatementContext",
    );
    const result = await callable(data);
    return result.data;
  };

  /** 会社管理者向けの退職・アカウント削除履歴を取得します。 */
  const listLifecycleOperations = async (data) => {
    const callable = httpsCallable($functions, "listLifecycleOperations");
    const result = await callable(data);
    return result.data;
  };

  /** 誤退職を訂正しEmployeeだけを在職状態へ戻します。 */
  const reinstateEmployee = async (data) => {
    const callable = httpsCallable($functions, "reinstateEmployee");
    const result = await callable(data);
    return result.data;
  };

  /**
   * アカウント無効化
   * @param {Object} data
   * @param {string} data.uid - ユーザーID
   * @param {boolean} data.expectedDisabled - 画面が読み取った変更前disabled値
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
   * @param {boolean} data.expectedDisabled - 画面が読み取った変更前disabled値
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

  /** 自分の表示名とタグサイズを更新します。 */
  const updateOwnUserProfile = async (data) => {
    const callable = httpsCallable($functions, "updateOwnUserProfile");
    const result = await callable(data);
    return result.data;
  };

  /** 管理対象Userの通知受信設定を更新します。 */
  const updateUserNotificationSettings = async (data) => {
    const callable = httpsCallable(
      $functions,
      "updateUserNotificationSettings",
    );
    const result = await callable(data);
    return result.data;
  };

  /** 管理対象Userのroleを更新します。 */
  const updateUserRoles = async (data) => {
    const callable = httpsCallable($functions, "updateUserRoles");
    const result = await callable(data);
    return result.data;
  };

  return {
    checkEmailAvailability,
    createAdminAccount,
    checkUserPreRegistration,
    setupUserAccount,
    createStandaloneTemporaryUser,
    createEmployeeLinkedTemporaryUser,
    deleteTemporaryUser,
    terminateEmployee,
    deleteStandaloneRegisteredUser,
    getEmployeeReinstatementContext,
    listLifecycleOperations,
    reinstateEmployee,
    disableUser,
    enableUser,
    changeAdminUser,
    updateOwnUserProfile,
    updateUserNotificationSettings,
    updateUserRoles,
  };
};
