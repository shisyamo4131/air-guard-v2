// composables/useCreateUser.js
import { httpsCallable } from "firebase/functions";

export const useCreateUser = () => {
  const { $functions } = useNuxtApp();
  const errors = useErrorsStore();
  const logger = useLogger();
  const { startLoading, stopLoading } = useGlobalLoading();
  const sender = "useCreateUser";

  /**
   * Cloud Functions の createUserWithCompany を呼び出し、
   * 管理者ユーザーアカウントを作成します。
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   * @param {string} payload.companyName
   * @param {string} payload.companyNameKana
   * @param {string} payload.displayName
   * @returns {Promise<{ uid: string, companyId: string }>}
   */
  const createUserWithCompany = async ({
    email,
    password,
    companyName,
    companyNameKana,
    displayName,
  }) => {
    /** errors ストアを初期化 */
    errors.clear();
    startLoading(
      "createUserWithCompany",
      "管理者ユーザーアカウントを作成しています"
    );
    try {
      const callable = httpsCallable($functions, "createUserWithCompany");
      const { data } = await callable({
        email,
        password,
        companyName,
        companyNameKana,
        displayName,
      });

      logger.info({
        sender,
        message: `管理者ユーザー「${displayName}」が正常に作成されました（uid: ${data.uid}）。`,
      });

      return {
        uid: data.uid,
        companyId: data.companyId,
      };
    } catch (error) {
      logger.error({
        sender,
        message: error.message || "ユーザー作成中にエラーが発生しました",
        error,
      });
      throw error;
    } finally {
      stopLoading("createUserWithCompany");
    }
  };

  return {
    createUserWithCompany,
  };
};
