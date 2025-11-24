import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";

/**
 * 利用者アカウント登録
 */
export const useCreateNormalUser = () => {
  const { $auth } = useNuxtApp();
  const auth = $auth;
  const { checkUserPreRegistration, checkEmailAvailability, setupUserAccount } =
    useAuthFunctions();

  /**
   * 利用者アカウント登録処理
   * @param {Object} params
   * @param {string} params.email - メールアドレス
   * @param {string} params.password - パスワード
   * @param {boolean} [params.skipPreRegCheck=false] - 事前登録確認をスキップするか
   * @param {boolean} [params.skipEmailCheck=false] - メールアドレスチェックをスキップするか
   * @returns {Promise<{success: boolean, userCredential: UserCredential}>}
   */
  const signupUser = async ({
    email,
    password,
    skipPreRegCheck = false,
    skipEmailCheck = false,
  }) => {
    try {
      let preReg;

      // 1. 事前登録確認（スキップフラグがfalseの場合のみ）
      if (!skipPreRegCheck) {
        preReg = await checkUserPreRegistration({ email });

        if (!preReg.isPreRegistered) {
          throw new Error(
            "事前登録が見つかりません。\n管理者にお問い合わせください。"
          );
        }
      } else {
        // スキップする場合は再度取得（setupUserAccountで必要）
        preReg = await checkUserPreRegistration({ email });
      }

      // 2. メールアドレス重複チェック（スキップフラグがfalseの場合のみ）
      if (!skipEmailCheck) {
        await checkEmailAvailability({ email, isAdmin: false });
      }

      // 3. Authenticationアカウント作成
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      try {
        // 4. メール認証送信
        await sendEmailVerification(userCredential.user);

        // 5. Userドキュメント作成（仮→本登録）
        await setupUserAccount({
          companyId: preReg.companyId,
          tempUserId: preReg.tempUserId,
        });

        // 6. カスタムクレーム反映（トークンリフレッシュ）
        await userCredential.user.getIdToken(true);

        return { success: true, userCredential };
      } catch (error) {
        console.error("Account setup error:", error);

        throw new Error(
          `アカウントの設定中にエラーが発生しました。\n` +
            `管理者またはカスタマーサポートまでお問い合わせください。\n` +
            `(UID: ${userCredential.user.uid})`
        );
      }
    } catch (error) {
      console.error("User signup error:", error);
      throw error;
    }
  };

  return { signupUser };
};
