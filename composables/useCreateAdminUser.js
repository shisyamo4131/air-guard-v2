import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";

/**
 * 管理者アカウント登録
 */
export const useCreateAdminUser = () => {
  const { $auth } = useNuxtApp();
  const auth = $auth;
  const { checkEmailAvailability } = useAuthFunctions();

  /**
   * 管理者アカウント登録処理
   * @param {Object} params
   * @param {string} params.email - メールアドレス
   * @param {string} params.password - パスワード
   * @param {string} params.companyName - 会社名
   * @param {string} params.companyNameKana - 会社名カナ
   * @param {string} params.displayName - 表示名
   * @param {boolean} [params.skipEmailCheck=false] - メールアドレスチェックをスキップするか
   * @returns {Promise<{success: boolean, userCredential: UserCredential}>}
   */
  const signupAdmin = async ({
    email,
    password,
    companyName,
    companyNameKana,
    displayName,
    skipEmailCheck = false,
  }) => {
    try {
      // 1. メールアドレス重複チェック（スキップフラグがfalseの場合のみ）
      if (!skipEmailCheck) {
        await checkEmailAvailability({ email });
      }

      // 2. Authenticationアカウント作成（自動的にサインイン）
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      try {
        // 3. メール認証送信
        await sendEmailVerification(userCredential.user);

        // 4. メール確認後のCompany・User作成に必要な値だけを一時保存
        localStorage.setItem(
          `airguard-v2:pending-admin-account-setup:${userCredential.user.uid}`,
          JSON.stringify({
            companyName,
            companyNameKana,
            displayName,
          }),
        );

        return { success: true, userCredential };
      } catch (error) {
        // 認証メール送信または一時保存でエラー
        console.error("Account setup error:", error);

        // Authenticationアカウントは残るため、カスタマーサポート対応が必要
        throw new Error(
          `アカウントの設定中にエラーが発生しました。\n` +
            `カスタマーサポートまでお問い合わせください。\n` +
            `(UID: ${userCredential.user.uid})`,
        );
      }
    } catch (error) {
      console.error("Admin signup error:", error);
      throw error;
    }
  };

  return { signupAdmin };
};
