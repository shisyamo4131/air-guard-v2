/*****************************************************************************
 * @file ./functions/apis/checkUserPreRegistration.js
 * @description 一般Userの事前登録状態を予約pointerから確認するCallable APIです。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  CHECK_USER_PRE_REGISTRATION_ERROR_CODES,
  CheckUserPreRegistrationError,
  checkUserPreRegistration as checkUserPreRegistrationUseCase,
  resolveCheckUserPreRegistrationEmail,
} from "../modules/auth/checkUserPreRegistration.js";

/**
 * ユーザー事前登録確認
 * 利用者自身が本登録を行う際に、管理者による仮登録が完了しているかどうかを確認
 * 未認証状態での実行も想定されるため、request.auth のチェックは行わない。
 * @param {Object} request
 * @param {Object} request.data
 * @param {string} request.data.email - 確認するメールアドレス
 * @return {Object} 登録状況
 * @return {boolean} return.isPreRegistered - 事前登録されているかどうか
 */
export const checkUserPreRegistration = onCall(async (request) => {
  try {
    const email = resolveCheckUserPreRegistrationEmail(request.data?.email);
    return await checkUserPreRegistrationUseCase({
      firestore: getFirestore(),
      email,
    });
  } catch (error) {
    let code = "internal";
    let message = "ユーザー事前登録確認中に予期しないエラーが発生しました。";
    if (
      error instanceof CheckUserPreRegistrationError &&
      error.code === CHECK_USER_PRE_REGISTRATION_ERROR_CODES.INPUT_INVALID
    ) {
      code = "invalid-argument";
      message = "メールアドレスの形式が正しくありません。";
    }

    if (code === "internal") {
      logger.error("User pre-registration check failed", {
        operation: "check-user-pre-registration",
        errorName:
          typeof error?.name === "string" ? error.name : "UnknownError",
        errorCode:
          typeof error?.code === "string" || typeof error?.code === "number"
            ? error.code
            : "unknown",
        callableCode: code,
      });
    }
    throw new HttpsError(code, message);
  }
});
