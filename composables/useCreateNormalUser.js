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
  const { checkUserPreRegistration, checkEmailAvailability } =
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
      // 1. 事前登録確認（スキップフラグがfalseの場合のみ）
      if (!skipPreRegCheck) {
        const preReg = await checkUserPreRegistration({ email });

        if (!preReg.isPreRegistered) {
          throw new Error(
            "事前登録が見つかりません。\n管理者にお問い合わせください。"
          );
        }
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

        // User本登録はメール確認後にunconfirmedEmail画面から行う
        return { success: true, userCredential };
      } catch (error) {
        console.error("Email verification setup error:", error);

        throw new Error(
          `認証メールの送信中にエラーが発生しました。\n` +
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
