// composables/useCreateUser.js
import { httpsCallable } from "firebase/functions";
import { useLogger } from "./useLogger.js";

export const useCreateUser = () => {
  const { $functions } = useNuxtApp();
  const logger = useLogger();
  const sender = "useCreateUser";

  /**
   * Firebase Functions: createUserWithCompany を呼び出す
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

      throw error; // ← 元のエラーオブジェクトをそのまま投げる（エラー管理ストア対応）
    }
  };

  return {
    createUserWithCompany,
  };
};
