/*****************************************************************************
 * @file ./functions/apis/setupUserAccount.js
 * @description 一般Userの本登録を完了するCallable APIです。
 * @method setupUserAccount 確認済みAuthentication Userを本登録Userへ変換します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setupUserAccount as setupUserAccountUseCase } from "../modules/auth/setupUserAccount.js";
import { mapUserAccountSetupError } from "../modules/auth/mapUserAccountSetupError.js";

/**
 * 一般User本登録Callableを処理します。
 *
 * Authenticationの確認済みメールアドレスから事前登録を解決するため、
 * クライアント指定の会社ID・仮User IDは使用しません。policyを含む
 * use-caseとFirebaseサービスは固定し、実装依存関係を差し替える
 * production APIは公開しません。
 *
 * @param {Object} request - Callableリクエスト
 * @return {Promise<{success: boolean, companyId: string, userId: string}>}
 */
async function handleSetupUserAccountRequest(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  try {
    return await setupUserAccountUseCase({
      auth: getAuth(),
      firestore: getFirestore(),
      authUid: request.auth.uid,
      authEmail: request.auth.token?.email,
      authEmailVerified: request.auth.token?.email_verified,
    });
  } catch (error) {
    const mappedError = mapUserAccountSetupError(error);
    logger.error("User account setup failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
}

export const setupUserAccount = onCall(async (request) => {
  return handleSetupUserAccountRequest(request);
});
